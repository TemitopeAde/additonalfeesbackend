import express from 'express';
import { createClient } from '@wix/sdk';
import { additionalFees } from '@wix/ecom/service-plugins';

const app = express();
const port = 5000;

// 1. Create the Wix Client
// Use your App ID and Public Key from the Wix Dev Center
const wixClient = createClient({
    auth: {
        appId: '56d969fd-3013-43ba-b5e0-a70d0051f235',
        publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApAd68t5oFvUNmarYhtx+
4ZT8BJopj/6rwte4W0teid0kU4ZaJslY9V8OpoHw27OZhHUk9ikQOHARrEWjAYvX
9jP6Kviop9MNRONDAyVxORX5XR1HUF732HRssTCkq0YFQPCQa6KXhzzWBXQ4wDf6
S6LCphbjw9+zyORj1Ksw/hZuEfZGWA1VtHDxWtxvCiW03h6j97pQD3VLLVcyScRD
PBt8ZZueL7RTuZPvFxHi1PgijA+gmlV3eMiTNP6+DbHP9Rf5sfgHB/3jL0MMDHDQ
W2sEKSRkKyhA9aIsFr9tmcvxvyd7IX/NkRrYg3mXDIXa90btmzfKhKiI40Lxc/H/
xQIDAQAB
-----END PUBLIC KEY-----`
    },
    modules: { additionalFees }
});

// 2. Define the Handler Logic
wixClient.additionalFees.provideHandlers({
    calculateAdditionalFees: async (payload) => {
        const { request, metadata } = payload;

        // Custom logic: Add a $5 fee if there are more than 3 items
        let fees = [];
        const totalQuantity = request.lineItems.reduce((acc, item) => acc + item.quantity, 0);

        fees.push({
            code: "bulk-handling-fee",
            name: "Bulk Handling Fee",
            price: "5.00",
            taxDetails: {
                taxable: false
            }
        });
        // The currency returned MUST match the site's currency (metadata.currency)
        // as specified in the SDK reference: 
        // https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/extensions/additional-fees/additional-fees-service-plugin/calculate-additional-fees?apiView=SDK
        return {
            additionalFees: fees,
            currency: metadata.currency
        };
    }
});

// 3. Expose the Endpoint
// Wix calls this endpoint with a POST request. 
// The wixClient.process(req) method handles JWT decryption and routing to handlers.
app.post('/plugins-and-webhooks/*', async (req, res) => {
    try {
        const result = await wixClient.process(req);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Additional Fees service listening at http://localhost:${port}`);
});
