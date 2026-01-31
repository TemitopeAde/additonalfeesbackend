import express from 'express';
import { createClient } from '@wix/sdk';
import { additionalFees } from '@wix/ecom/service-plugins';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const port = 5000;

const parseTextPlainJwt = (req, res, next) => {
    if (req.is('text/plain')) {
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', chunk => raw += chunk);
        req.on('end', () => {
            try {
                const decoded = jwt.decode(raw, { complete: false });
                req.body = decoded;
            } catch (e) {
                console.log(JSON.stringify({ event: 'jwt_decode_error', error: String(e) }));
                req.body = {};
            }
            next();
        });
    } else {
        next();
    }
};

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
        console.log(req.body);
    } catch (error) {
        console.error(error);

    }

});

app.listen(port, () => {
    console.log(`Additional Fees service listening at http://localhost:${port}`);
});
