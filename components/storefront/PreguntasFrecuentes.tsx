"use client";

import { SUBSCRIPTION_FAQ } from "@/constants/subscription-faq";

export default function PreguntasFrecuentes() {
  return (
    <section className="py-16 bg-[#faf7f4]">
          <div className="max-w-2xl mx-auto px-4">
            <h2 className="text-2xl font-playfair text-[#1a0f08] text-center mb-8">Preguntas frecuentes</h2>
            <div className="space-y-4">
              {SUBSCRIPTION_FAQ.map(faq => (
                <div key={faq.question} className="bg-white rounded-2xl border border-[#e8ddd0] p-5">
                  <p className="font-semibold text-[#1a0f08] text-sm mb-2">{faq.question}</p>
                  <p className="text-sm text-[#5a3a28]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
  )
}
