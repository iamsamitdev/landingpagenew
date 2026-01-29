import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { OpenAIEmbeddings } from "@langchain/openai"
import { createClient } from "@supabase/supabase-js"
import { Document } from "@langchain/core/documents"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// โหลด environment variables
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

// ตรวจสอบ environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in environment variables")
  console.log("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

if (!openaiApiKey) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables")
  process.exit(1)
}

// สร้าง Supabase Admin Client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// โฟลเดอร์เก็บเอกสาร
const DOCUMENTS_PATH = "./documents"

async function ingestDocuments() {
  console.log("🚀 Starting document ingestion...")
  console.log(`📂 Looking for documents in: ${path.resolve(DOCUMENTS_PATH)}`)

  // ตรวจสอบว่ามีโฟลเดอร์ documents หรือไม่
  if (!fs.existsSync(DOCUMENTS_PATH)) {
    fs.mkdirSync(DOCUMENTS_PATH, { recursive: true })
    console.log("📁 Created documents folder. Please add PDF or TXT files and run again.")
    return
  }

  // อ่านไฟล์ทั้งหมดในโฟลเดอร์
  const files = fs.readdirSync(DOCUMENTS_PATH)
  const pdfFiles = files.filter(f => f.endsWith(".pdf"))
  const txtFiles = files.filter(f => f.endsWith(".txt"))

  if (pdfFiles.length === 0 && txtFiles.length === 0) {
    console.log("⚠️ No PDF or TXT files found in documents folder.")
    console.log("📝 Please add documents to the 'documents' folder and run again.")
    return
  }

  console.log(`📚 Found ${pdfFiles.length} PDF files and ${txtFiles.length} TXT files`)

  const allDocs = []

  // โหลด PDF files
  for (const file of pdfFiles) {
    const filePath = path.join(DOCUMENTS_PATH, file)
    console.log(`📄 Loading PDF: ${file}`)
    
    try {
      const loader = new PDFLoader(filePath)
      const docs = await loader.load()
      
      // เพิ่ม metadata
      docs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          source: file,
          type: "pdf",
        }
      })
      
      allDocs.push(...docs)
      console.log(`   ✅ Loaded ${docs.length} pages from ${file}`)
    } catch (error) {
      console.error(`   ❌ Error loading ${file}:`, error)
    }
  }

  // โหลด TXT files (ใช้ fs อ่านไฟล์โดยตรง)
  for (const file of txtFiles) {
    const filePath = path.join(DOCUMENTS_PATH, file)
    console.log(`📄 Loading TXT: ${file}`)
    
    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const doc = new Document({
        pageContent: content,
        metadata: {
          source: file,
          type: "txt",
        },
      })
      
      allDocs.push(doc)
      console.log(`   ✅ Loaded ${file}`)
    } catch (error) {
      console.error(`   ❌ Error loading ${file}:`, error)
    }
  }

  if (allDocs.length === 0) {
    console.log("❌ No documents could be loaded. Please check your files.")
    return
  }

  console.log(`\n📚 Total documents loaded: ${allDocs.length}`)

  // แบ่งเอกสารเป็น Chunks
  console.log("\n✂️ Splitting documents into chunks...")
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const splitDocs = await textSplitter.splitDocuments(allDocs)
  console.log(`✅ Created ${splitDocs.length} chunks`)

  // สร้าง Embeddings
  console.log("\n🔄 Creating embeddings...")
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: openaiApiKey,
  })

  // ลบข้อมูลเก่าออกก่อน (optional)
  console.log("🗑️ Clearing existing documents...")
  const { error: deleteError } = await supabaseAdmin
    .from("documents")
    .delete()
    .neq("id", 0) // ลบทุก row

  if (deleteError) {
    console.warn("⚠️ Could not clear existing documents:", deleteError.message)
  }

  // บันทึกลง Supabase
  console.log("\n💾 Saving to Supabase...")
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < splitDocs.length; i++) {
    const doc = splitDocs[i]
    
    try {
      // สร้าง embedding สำหรับ chunk นี้
      const embedding = await embeddings.embedQuery(doc.pageContent)

      // แปลง embedding array เป็น pgvector format string: [0.1,0.2,0.3,...]
      const embeddingString = `[${embedding.join(",")}]`

      // บันทึกลง database
      const { error } = await supabaseAdmin.from("documents").insert({
        content: doc.pageContent,
        metadata: doc.metadata,
        embedding: embeddingString,
      })

      if (error) {
        console.error(`❌ Error saving chunk ${i + 1}:`, error.message)
        errorCount++
      } else {
        successCount++
        // แสดง progress ทุก 10 chunks
        if ((i + 1) % 10 === 0 || i === splitDocs.length - 1) {
          const progress = Math.round(((i + 1) / splitDocs.length) * 100)
          console.log(`   📊 Progress: ${i + 1}/${splitDocs.length} (${progress}%)`)
        }
      }
    } catch (error) {
      console.error(`❌ Error processing chunk ${i + 1}:`, error)
      errorCount++
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log("🎉 Document ingestion completed!")
  console.log(`✅ Successfully saved: ${successCount} chunks`)
  if (errorCount > 0) {
    console.log(`❌ Failed: ${errorCount} chunks`)
  }
  console.log("=".repeat(50))
}

// รัน script
ingestDocuments().catch(error => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
