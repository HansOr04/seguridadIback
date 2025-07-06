const jwt = require('jsonwebtoken');

const jwtConfig = {
  secret: process.env.JWT_SECRET || 'sigrisk-ec-default-secret-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'sigrisk-ec-refresh-secret-change-in-production',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: 'SIGRISK-EC-MAGERIT',
  audience: 'sigrisk-ec-users'
};

const generateToken = (payload) => {
  return jwt.sign(
    payload,
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    jwtConfig.refreshSecret,
    {
      expiresIn: jwtConfig.refreshExpiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, jwtConfig.secret, {
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshSecret, {
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  });
};

module.exports = {
  jwtConfig,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken
};