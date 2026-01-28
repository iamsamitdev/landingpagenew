export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

// ฟังก์ชันส่ง PageView (ดูหน้าเว็บ)
export const pageview = () => {
  if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
    (window as any).fbq("track", "PageView")
  }
}

// Interface สำหรับ Event Options
interface EventOptions {
  eventID?: string
  [key: string]: unknown
}

// ฟังก์ชันส่ง Custom Event (เช่น สั่งซื้อ, กรอกฟอร์ม)
// รองรับ eventID สำหรับ Deduplication กับ CAPI
export const event = (
  name: string, 
  data: Record<string, unknown> = {}, 
  options: EventOptions = {}
) => {
  if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
    if (options.eventID) {
      // ส่งพร้อม eventID สำหรับ Deduplication
      (window as any).fbq("track", name, data, { eventID: options.eventID })
    } else {
      (window as any).fbq("track", name, data)
    }
  }
}