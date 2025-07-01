import { AsyncAPIDocumentInterface, ChannelInterface } from '@asyncapi/parser';

export const getChannelProtocols = (channel: ChannelInterface): string[] => {
  const protocols = [];

  const bindings = channel.bindings();
  for (const binding of bindings) {
    protocols.push(binding.protocol());
  }

  return protocols;
};

export const getChannelTags = (channel: ChannelInterface): string[] => {
  const tags: string[] = [];
  const jsonTags = channel.json()?.tags;

  if (Array.isArray(jsonTags)) {
    for (const tag of jsonTags) {
      if (tag.name && !tags.includes(tag.name)) {
        tags.push(tag.name);
      }
    }
  }

  return tags;
};

export const defaultMarkdown = (_document: AsyncAPIDocumentInterface, channel: ChannelInterface) => {
  return `
  ${
    channel.hasDescription()
      ? `
  ## Overview
  ${channel.description()}
  `
      : ''
  }

  <ChannelInformation />

  ${
    channel.json()?.externalDocs
      ? `
  ## External documentation
  - [${channel.json()?.externalDocs?.description}](${channel.json()?.externalDocs?.url})
  `
      : ''
  }
  
  `;
};
