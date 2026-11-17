/** A small API response with the cases worth showing: optional keys, nulls, shared shapes. */
export const SAMPLE = JSON.stringify(
  {
    id: "ord_8f2k",
    status: "shipped",
    total: 84.5,
    paid: true,
    "created-at": "2026-11-17T09:12:00Z",
    customer: {
      id: 412,
      name: "Ada Byron",
      email: "ada@example.com",
      phone: null,
    },
    shippingAddress: { line1: "12 Analytical St", city: "London", postcode: "N1 9GU" },
    billingAddress: { line1: "12 Analytical St", city: "London", postcode: "N1 9GU" },
    items: [
      { sku: "KB-75", title: "Mechanical keyboard", qty: 1, price: 69 },
      { sku: "CAB-C", title: "USB-C cable", qty: 2, price: 7.75, discount: { code: "BUNDLE", percent: 10 } },
    ],
    tags: ["gift", "priority"],
    notes: [],
  },
  null,
  2,
);
