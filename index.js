import express from 'express';
import { AppStrategy, createClient } from '@wix/sdk';
import { additionalFees } from '@wix/ecom/service-plugins';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();


function getWixClient(instanceId) {
    return createClient({
        auth: AppStrategy({
            appId: '56d969fd-3013-43ba-b5e0-a70d0051f235',
            appSecret: '9db44f06-ea8a-49ac-a5d3-11414653340d',
            instanceId
        }),
        modules: { items }
    });
}

const parseTextPlainJwt = (req, res, next) => {
    if (req.is('text/plain') && typeof req.body === 'string') {
        try {
            const decoded = jwt.decode(req.body);
            req.body = decoded;
        } catch (e) {
            console.error('JWT decode failed:', e);
            req.body = {};
        }
    }
    next();
};

app.use(cors());
app.use(express.text({ type: 'text/plain' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(parseTextPlainJwt);

const port = 5000;

const collectionId = '@hi-konsult/products-additonal-fees/ProductsSetup';


async function fetchConfig(instanceId) {
    try {
        const wixClient = getWixClient(instanceId);
        const results = await wixClient.items.query(collectionId).find();
        const configItems = results.items || [];
        console.log('📦 Wix Config:', JSON.stringify(configItems, null, 2));
        return configItems;
    } catch (error) {
        console.error('❌ Error fetching configuration from Wix Data:', error);
        return [];
    }
}


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

wixClient.additionalFees.provideHandlers({
    calculateAdditionalFees: async (payload) => {
        const { request, metadata } = payload;
        console.log(JSON.stringify(request, null, 2));


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

        return {
            additionalFees: fees,
            currency: metadata.currency
        };
    }
});


app.post('/plugins-and-webhooks/*', async (req, res) => {
    try {
        const result = await wixClient.process(req);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/v1/calculate-additional-fees', async (req, res) => {
    try {
        // In a production environment, req.body is typically a decoded JWT payload.
        // You should extract the currency from the request to ensure a match.
        console.log(JSON.stringify(req.body, null, 2));
        const instanceId = req.body.data.metadata.instanceId;

        const config = await fetchConfig(instanceId);
        console.log(JSON.stringify(config, null, 2));


        return res.status(200).json({
            "additionalFees": [
                {
                    "code": "sample-handling-fee",
                    "name": "Special Handling Fee",
                    "price": "5.00", // The price must be a string and exclude taxes.
                    "taxDetails": {
                        "taxable": true // Indicates if this fee is subject to tax.
                    },
                    "lineItemIds": ["00000000-0000-0000-0000-000000000001"] // Optional: associate the fee with specific line items.
                }
            ],
            "currency": "USD" // This must match the site's currency (e.g., req.body.currency).
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }

});

app.listen(port, () => {
    console.log(`Additional Fees service listening at http://localhost:${port}`);
});
