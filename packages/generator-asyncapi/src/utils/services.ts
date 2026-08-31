import { AsyncAPIDocumentInterface } from '@asyncapi/parser';
import { escapeSpecialCharactersThatBreakMarkdown } from './markdown';

export const defaultMarkdown = (document: AsyncAPIDocumentInterface) => {
  return `

${document.info().hasDescription() ? `${escapeSpecialCharactersThatBreakMarkdown(document.info().description() as string)}` : ''}

## Architecture diagram
<NodeGraph />

${
  document.info().externalDocs()
    ? `
## External documentation
- [${document.info().externalDocs()?.description()}](${document.info().externalDocs()?.url()})
`
    : ''
}
`;
};

export const getSummary = (document: AsyncAPIDocumentInterface) => {
  const summary = document.info().hasDescription() ? document.info().description() : '';
  return summary && summary.length < 150 ? summary : '';
};
