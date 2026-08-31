export const escapeSpecialCharactersThatBreakMarkdown = (text: string) => {
  // find code blocks (fenced and inline), and don't escape the characters within them, but escape the rest
  const codeBlockRegex = /```[\s\S]*?```|`[^`\n]*`/g;
  const codeBlocks: string[] = [];
  const placeholders: string[] = [];

  // Replace code blocks with placeholders and store them
  let processedText = text.replace(codeBlockRegex, (match, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    codeBlocks.push(match);
    placeholders.push(placeholder);
    return placeholder;
  });

  // Escape characters that MDX would parse as JSX expressions ({}) or tags (<) outside of code blocks
  processedText = processedText.replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/</g, '\\<');

  // Restore code blocks with their original characters
  placeholders.forEach((placeholder, index) => {
    processedText = processedText.replace(placeholder, codeBlocks[index]);
  });

  return processedText;
};
