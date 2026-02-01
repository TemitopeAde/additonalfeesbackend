import express from 'express';
import { AppStrategy, createClient } from '@wix/sdk';
import { additionalFees } from '@wix/ecom/service-plugins';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { items } from '@wix/data';

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
        console.log(JSON.stringify(req.body, null, 2));

        const { request, metadata } = req.body.data;
        const instanceId = metadata.instanceId;
        const currency = metadata.currency || 'USD';
        const subtotal = parseFloat(request.subtotal) || 0;

        // Fetch fee configurations from Wix collection
        const configItems = await fetchConfig(instanceId);

        // Get all product IDs from line items
        const lineItems = request.lineItems || [];

        // Collect fees for all products in the cart
        const feeMap = new Map(); // Use map to aggregate fees by optionId

        for (const lineItem of lineItems) {
            const productId = lineItem.catalogReference?.catalogItemId;
            const quantity = lineItem.quantity || 1;
            const itemPrice = parseFloat(lineItem.price) || 0;
            const lineItemTotal = itemPrice * quantity;

            if (!productId) continue;

            // Find fee config for this product
            const productConfig = configItems.find(c => c.productId === productId);

            if (!productConfig || !productConfig.fees) continue;

            // Parse fees JSON string
            let fees = [];
            try {
                fees = typeof productConfig.fees === 'string'
                    ? JSON.parse(productConfig.fees)
                    : productConfig.fees;
            } catch (e) {
                console.error('Error parsing fees:', e);
                continue;
            }

            // Calculate each fee
            for (const fee of fees) {
                if (!fee.enabled) continue;

                let feeAmount = 0;

                switch (fee.type) {
                    case 'FIXED':
                        feeAmount = fee.value;
                        break;
                    case 'PERCENTAGE':
                        feeAmount = (fee.value / 100) * lineItemTotal;
                        break;
                    case 'PER_ITEM':
                        feeAmount = fee.value * quantity;
                        break;
                    default:
                        feeAmount = fee.value;
                }

                // Aggregate fees by optionId
                if (feeMap.has(fee.optionId)) {
                    const existing = feeMap.get(fee.optionId);
                    existing.price += feeAmount;
                } else {
                    feeMap.set(fee.optionId, {
                        code: fee.optionId,
                        name: fee.label || fee.optionId,
                        price: feeAmount,
                        taxDetails: {
                            taxable: true
                        }
                    });
                }
            }
        }

        // Convert fee map to array and format prices
        const additionalFees = Array.from(feeMap.values()).map(fee => ({
            ...fee,
            price: fee.price.toFixed(2)
        }));

        console.log('📦 Calculated Additional Fees:', JSON.stringify(additionalFees, null, 2));

        return res.status(200).json({
            additionalFees,
            currency
        });
    } catch (error) {
        console.error('Error calculating additional fees:', error);
        return res.status(500).json({ error: "Internal Server Error" });
    }

});


app.post('/webhook', express.text(), (request, response) => {
    let event;
    let eventData;

    const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApAd68t5oFvUNmarYhtx+
4ZT8BJopj/6rwte4W0teid0kU4ZaJslY9V8OpoHw27OZhHUk9ikQOHARrEWjAYvX
9jP6Kviop9MNRONDAyVxORX5XR1HUF732HRssTCkq0YFQPCQa6KXhzzWBXQ4wDf6
S6LCphbjw9+zyORj1Ksw/hZuEfZGWA1VtHDxWtxvCiW03h6j97pQD3VLLVcyScRD
PBt8ZZueL7RTuZPvFxHi1PgijA+gmlV3eMiTNP6+DbHP9Rf5sfgHB/3jL0MMDHDQ
W2sEKSRkKyhA9aIsFr9tmcvxvyd7IX/NkRrYg3mXDIXa90btmzfKhKiI40Lxc/H/
xQIDAQAB
-----END PUBLIC KEY-----`;


    try {
        const rawPayload = jwt.verify(request.body, PUBLIC_KEY);
        event = JSON.parse(rawPayload.data);
        eventData = JSON.parse(event.data);
    } catch (err) {
        console.error(err);
        response.status(400).send(`Webhook error: ${err.message}`);
        return;
    }

    switch (event.eventType) {
        case "AppInstalled":
            console.log(`AppInstalled event received with data:`, eventData);
            console.log(`App instance ID:`, event.instanceId);
            //
            // handle your event here
            //
            break;
        default:
            console.log(`Received unknown event type: ${event.eventType}`);
            break;
    }

    response.status(200).send();

});


app.listen(port, () => {
    console.log(`Additional Fees service listening at http://localhost:${port}`);
});
