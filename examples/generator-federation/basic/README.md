# EventCatalog Federation Example

This example shows you how to use EventCatalog federation to connect multiple EventCatalog instances together.

![Federation Example](../../../images/federation-catalog.png)

In this example we have three teams `customer-experience-team`, `order-management-team` and `payment-team`. Each team has their own EventCatalog instance and keeps there catalog close to their code.

We also have a central EventCatalog instance that is used to view all the teams catalogs and merge them together using federation.

### Why Federation?

Federation can help large organizations and teams to:

- Keep their catalog close to their code (no need to swap context)
- Keep their catalog up to date with their code
- Merge many catalogs into a single catalog for an organization
- Create a single source of truth for an organization
- Ease the burden of keeping multiple catalogs in sync
- Ease the burden of keeping documentation up to date as it's close to the code
- Surface relevant information from across an organization

### How it works

1. Teams create their own EventCatalog instance. This can be next to the their code or where ever they want.
1. Teams generate there documentation (using plugins or just manual). 
1. They commit their documentation to their repository.
1. The central catalog is created, and using the federation plugin it merges many catalogs together into one view.
1. The central catalog is hosted for the organization where people can view the merged catalog and single source of truth.

**Making changes to catalogs**

1. Teams continue to make changes to their own catalogs as they always have.
1. The central catalog is updated using the federation plugin and changes are merged into the central catalog.
1. The central catalog is rebuilt and redeployed.

### Running this example

1. Clone the repository and go into the `central-catalog` directory
1. Run `npm install`
1. Run the generate command (this will merge many teams catalogs into one, in this example we are merging the `customer-experience-team`, `order-management-team` and `payment-team` catalogs into one central catalog)
1. Run the catalog locally 
1. View your catalog at https://localhost:3000

This generator is source-available under the [Business Source License 1.1](../../../LICENSE), the same licence as [EventCatalog](https://github.com/event-catalog/eventcatalog/blob/main/LICENSE). Eligible organisations (under USD 10M revenue and under USD 10M funding) can use it free, as-is. Other production use is covered by an EventCatalog subscription. See [EventCatalog pricing](https://www.eventcatalog.dev/pricing).
