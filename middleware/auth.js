const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'library_sec';

function authenticate(req, res, next) {
    const header =req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({error: 'No token provided'});
    }
    const token = header.slice(7);
    try{
        req.user = jwt.verify(token, SECRET);
        next();
    } catch(e){
        return res.status(403).json({error: 'Invalid token'});
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
        }
        next();
    };
}
function signToken(payload) {
    return jwt.sign(payload, SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });
}
module.exports = {authenticate, requireRole, signToken};