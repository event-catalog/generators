import { APIGatewayClient } from '@aws-sdk/client-api-gateway';
import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';
import { getOpenApiSpec, getRestApiIdByName } from './utils/apigateway';
import { hydrate } from './utils/hydrate-openapi-file';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import fs from 'fs/promises';
import checkLicense from '../../../shared/checkLicense';
import pkgJSON from '../package.json';
import { checkForPackageUpdate } from '../../../shared/check-for-package-update';

export type Route = {
  type: 'command' | 'query' | 'event';
  id?: string;
  name?: string;
  description?: string;
};

export type API = {
  name: string;
  region: string;
  stageName: string;
  version?: number;
  routes: Record<string, Route>;
};

type Props = {
  debug?: boolean;
  licenseKey?: string;
  apis: API[];
  output?: string;
  credentials?: AwsCredentialIdentity | AwsCredentialIdentityProvider;
};

export default async (_: any, options: Props) => {
  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  if (!process.env.PROJECT_DIR) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  // Check for license and package update
  const LICENSE_KEY: string  = process.env.EVENTCATALOG_LICENSE_KEY_AMAZON_APIGATEWAY || options.licenseKey || '';
  await checkLicense(pkgJSON.name, LICENSE_KEY);
  await checkForPackageUpdate(pkgJSON.name);

  const outputDir = options.output
    ? join(process.env.PROJECT_DIR, options.output)
    : join(process.env.PROJECT_DIR, 'amazon-apigateway-specs');

  console.log(chalk.green(`Processing ${options.apis.length} apis with API Gateway`));

  // Loop through all the APIS and hydrate the openapi spec
  for (const api of options.apis) {
    console.log(chalk.gray(`Processing ${api.name} in ${api.region} with Amazon API Gateway...`));

    const client = new APIGatewayClient({ region: api.region, credentials: options.credentials });

    const apiName = await getRestApiIdByName(client, api.name);

    if (!apiName) {
      console.log(chalk.yellow(` - API with name '${api.name}' not found, skipping import...`));
      continue;
    }

    const openApiSpec = await getOpenApiSpec(client, apiName, api.stageName);

    console.log(chalk.cyan(` - Found OpenAPI file, hydrating with EventCatalog extensions...`));
    const hydratedSpec = await hydrate(openApiSpec, api.routes, api.version);

    const output = join(outputDir, `${api.name}.json`);

    // ensure the directory exists
    await fs.mkdir(outputDir, { recursive: true });

    console.log(chalk.cyan(` - Writing OpenAPI file to ${output}...`));
    await writeFile(output, JSON.stringify(hydratedSpec, null, 2));
  }

  console.log(chalk.green(`\nFinished generating event catalog with Amazon API Gateway Apis.`));
  console.log(chalk.green(`\nSpecifications have been written to ${outputDir}`));
};
