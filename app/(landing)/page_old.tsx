"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {useState, useEffect } from "react"

export default function Home() {

  const [date, setDate] = useState<Date | undefined>(undefined)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setDate(new Date())
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div>
        <Button>Button</Button>
      </div>
      <div>
        {mounted && (
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-lg border"
          />
        )}
      </div>
    </div>
  )
}