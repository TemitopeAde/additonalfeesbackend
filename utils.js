export const parseTextPlainJwt = (req, res, next) => {
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