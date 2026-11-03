export function resolvePcbComponentSpecialStrings({
  text,
  componentDesignatorText,
  componentCommentText,
}: {
  text: string
  componentDesignatorText?: string
  componentCommentText?: string
}): string | undefined {
  const lowercasedText = text.toLowerCase()
  if (lowercasedText === ".designator") return componentDesignatorText ?? ""
  if (lowercasedText === ".comment") return componentCommentText ?? ""

  let hasComponentSpecialString = false
  const resolvedText = text.replace(/'\.[^'\r\n]*'/g, (token) => {
    const tokenName = token.slice(1, -1).toLowerCase()
    if (tokenName !== ".designator" && tokenName !== ".comment") return token
    hasComponentSpecialString = true
    const componentText =
      tokenName === ".designator"
        ? componentDesignatorText
        : componentCommentText
    // Hide unresolved whole labels; preserve unresolved embedded tokens.
    return componentText ?? (token === text ? "" : token)
  })
  return hasComponentSpecialString ? resolvedText : undefined
}
