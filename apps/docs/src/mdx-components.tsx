import type { ComponentType, HTMLAttributes } from "react"
import { CodeBlock } from "@/components/docs/code-block"

type MDXMap = Record<string, ComponentType<any>>

export function useMDXComponents(components: MDXMap): MDXMap {
  return {
    pre: (props: HTMLAttributes<HTMLPreElement>) => <CodeBlock {...props} />,
    ...components,
  }
}
