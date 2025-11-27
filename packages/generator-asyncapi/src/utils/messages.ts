import {
  MessageInterface,
  AsyncAPIDocumentInterface,
  ChannelInterface,
  ChannelsInterface,
  MessagesInterface,
} from '@asyncapi/parser';
import { getFileExtentionFromSchemaFormat } from './schemas';

export const defaultMarkdown = (_document: AsyncAPIDocumentInterface, message: MessageInterface) => {
  return `
## Architecture
<NodeGraph />

${
  messageHasSchema(message) && messageIsJSON(message)
    ? `
## Schema
<SchemaViewer file="${getSchemaFileName(message)}" title="Message Schema" maxHeight="500" />
`
    : ''
}
${
  messageHasSchema(message) && !messageIsJSON(message)
    ? `
## Schema
<Schema file="${getSchemaFileName(message)}" title="Message Schema" maxHeight="500" />
`
    : ''
}

${
  messageHasHeaders(message)
    ? `
## Attributes
<SchemaViewer file="${getHeadersSchemaFileName(message)}" title="Message Attributes Schema" maxHeight="500" />
`
    : ''
}

${
  message.externalDocs()
    ? `
## External documentation
- [${message.externalDocs()?.description()}](${message.externalDocs()?.url()})
`
    : ''
}

`;
};

export const getSummary = (message: MessageInterface) => {
  const messageSummary = message.hasSummary() ? message.summary() : '';
  const messageDescription = message.hasDescription() ? message.description() : '';

  let eventCatalogMessageSummary = messageSummary;

  if (!eventCatalogMessageSummary) {
    eventCatalogMessageSummary = messageDescription && messageDescription.length < 150 ? messageDescription : '';
  }

  return eventCatalogMessageSummary;
};

export const messageHasSchema = (message: MessageInterface) => {
  return message.hasPayload() && message.schemaFormat();
};

export const messageIsJSON = (message: MessageInterface) => {
  const fileName = getSchemaFileName(message);
  return fileName.endsWith('.json');
};

export const messageHasHeaders = (message: MessageInterface) => {
  return message.hasHeaders();
};

export const getHeadersSchemaFileName = (message: MessageInterface) => {
  const extension = getFileExtentionFromSchemaFormat(message.schemaFormat());
  return `headers.${extension}`;
};

export const getSchemaFileName = (message: MessageInterface) => {
  const extension = getFileExtentionFromSchemaFormat(message.schemaFormat());
  return `schema.${extension}`;
};

export const getMessageName = (message: MessageInterface) => {
  return message.hasTitle() && message.title() ? (message.title() as string) : message.id();
};

export const getChannelsForMessage = (
  message: MessageInterface,
  channels: ChannelsInterface,
  document: AsyncAPIDocumentInterface
): { id: string; version: string }[] => {
  let channelsForMessage: ChannelInterface[] = [];
  const globalVersion = document.info().version();

  // Go through all channels and link messages they document
  for (const channel of channels) {
    for (const channelMessage of channel.messages() as MessagesInterface) {
      if (channelMessage.id() === message.id()) {
        channelsForMessage.push(channel);
      }
    }
  }

  // You can also document a message directly to a channel, add them too
  for (const messageChannel of message.channels()) {
    channelsForMessage.push(messageChannel);
  }

  // Make them unique, as there may be overlapping channels
  const uniqueChannels = channelsForMessage.filter(
    (channel, index, self) => index === self.findIndex((t) => t.id() === channel.id())
  );

  return uniqueChannels.map((channel) => {
    const channelVersion = channel.extensions().get('x-eventcatalog-channel-version')?.value() || globalVersion;
    return {
      id: channel.id(),
      version: channelVersion,
    };
  });
};
