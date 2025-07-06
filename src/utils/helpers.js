const crypto = require('crypto');

/**
 * Generar hash SHA256
 */
const generateHash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generar token aleatorio
 */
const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Validar RUC ecuatoriano
 */
const validateEcuadorianRUC = (ruc) => {
  if (!/^\d{13}$/.test(ruc)) return false;
  
  // Algoritmo de validación de RUC ecuatoriano
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    let product = parseInt(ruc[i]) * coefficients[i];
    if (product >= 10) {
      product = Math.floor(product / 10) + (product % 10);
    }
    sum += product;
  }
  
  const checkDigit = (Math.ceil(sum / 10) * 10) - sum;
  const finalDigit = checkDigit === 10 ? 0 : checkDigit;
  
  return finalDigit === parseInt(ruc[9]);
};

/**
 * Capitalizar primera letra
 */
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Formatear nombre completo
 */
const formatFullName = (firstName, lastName) => {
  return `${capitalize(firstName)} ${capitalize(lastName)}`;
};

/**
 * Validar formato de email
 */
const isValidEmail = (email) => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

/**
 * Obtener IP real del cliente
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

/**
 * Sanitizar objeto removiendo campos sensibles
 */
const sanitizeUser = (user) => {
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.security?.passwordResetToken;
  delete sanitized.security?.emailVerificationToken;
  delete sanitized.security?.twoFactorSecret;
  return sanitized;
};

/**
 * Generar respuesta API estándar
 */
const apiResponse = (status, message, data = null, errors = null) => {
  const response = {
    status,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) response.data = data;
  if (errors) response.errors = errors;
  
  return response;
};

/**
 * Calcular páginas para paginación
 */
const calculatePagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 25;
  const totalPages = Math.ceil(total / pageSize);
  const skip = (currentPage - 1) * pageSize;
  
  return {
    currentPage,
    pageSize,
    totalPages,
    total,
    skip,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

module.exports = {
  generateHash,
  generateRandomToken,
  validateEcuadorianRUC,
  capitalize,
  formatFullName,
  isValidEmail,
  getClientIP,
  sanitizeUser,
  apiResponse,
  calculatePagination
};