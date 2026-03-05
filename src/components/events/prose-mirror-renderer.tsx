import Image from "@tiptap/extension-image"
import StarterKit from "@tiptap/starter-kit"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"

import { cn } from "@/lib/utils"

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function normalizeNodeTypes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeNodeTypes)
  if (!node || typeof node !== "object") return node

  const obj = node as Record<string, unknown>
  return {
    ...obj,
    ...(typeof obj.type === "string" ? { type: snakeToCamel(obj.type) } : {}),
    ...(Array.isArray(obj.content) ? { content: obj.content.map(normalizeNodeTypes) } : {}),
  }
}

interface ProseMirrorRendererProps {
  doc: unknown
  className?: string
}

export function ProseMirrorRenderer({ doc, className }: ProseMirrorRendererProps) {
  if (!doc) return null

  const normalized = normalizeNodeTypes(doc)

  return (
    <div className={cn("prose prose-sm prose-slate max-w-none", className)}>
      {renderToReactElement({
        extensions: [StarterKit, Image],
        content: normalized as Parameters<typeof renderToReactElement>[0]["content"],
        options: { unhandledNode: () => null },
      })}
    </div>
  )
}
