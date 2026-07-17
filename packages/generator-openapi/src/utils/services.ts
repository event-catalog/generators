import { OpenAPI } from 'openapi-types';
import slugify from 'slugify';
import { Service } from '../types';
import path from 'path';
import type { Specification } from './specifications';

export const defaultMarkdown = (document: OpenAPI.Document, fileName: string) => {
  return `

${document.info.description ? `${document.info.description}` : ''}  

## Architecture diagram
<NodeGraph />

${
  document.externalDocs
    ? `
## External documentation
- [${document.externalDocs.description}](${document.externalDocs.url})
`
    : ''
}

`;
};

export const getSummary = (document: OpenAPI.Document) => {
  const summary = document.info.description ? document.info.description : '';
  return summary && summary.length < 150 ? summary : '';
};

export const buildService = (
  serviceOptions: Service,
  document: OpenAPI.Document,
  generateMarkdown?: ({}: { service: Service; document: OpenAPI.Document; markdown: string }) => string
) => {
  const schemaPath = path.basename(serviceOptions.path as string) || 'openapi.yml';
  const documentTags = document.tags || [];
  const serviceId = serviceOptions.id || slugify(document.info.title, { lower: true, strict: true });
  const generatedMarkdownForService = defaultMarkdown(document, schemaPath);
  const specificationName = document.info.title?.trim() || 'OpenAPI';
  return {
    id: serviceId,
    version: serviceOptions.version || document.info.version,
    name: document.info.title,
    summary: getSummary(document),
    schemaPath,
    specifications: [{ type: 'openapi', path: schemaPath, name: specificationName }] as Specification[],
    markdown: generateMarkdown
      ? generateMarkdown({ service: serviceOptions, document, markdown: generatedMarkdownForService })
      : generatedMarkdownForService,
    badges: documentTags.map((tag) => ({ content: tag.name, textColor: 'blue', backgroundColor: 'blue' })),
    owners: serviceOptions.owners || [],
    writesTo: serviceOptions.writesTo || [],
    readsFrom: serviceOptions.readsFrom || [],
  };
};
