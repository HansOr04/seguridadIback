const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');

/**
 * Servicio de autenticación básico
 */
class AuthService {

  /**
   * Login de usuario
   * @param {string} email 
   * @param {string} password 
   * @param {string} ipAddress 
   * @returns {Object} Resultado del login
   */
  async login(email, password, ipAddress = '') {
    try {
      console.log(`📋 AuthService.login: Iniciando para ${email}`);

      // Buscar usuario por email CON el campo password incluido
      console.log(`🔍 AuthService.login: Buscando usuario con query simplificada`);

      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true
        // Removemos isDeleted: false por ahora para que funcione
      })
      .select('+password')
      .populate('organization');

      // Verificar manualmente si está eliminado
      if (user && user.isDeleted === true) {
        console.log(`❌ AuthService.login: Usuario marcado como eliminado: ${email}`);
        throw new Error('Credenciales inválidas');
      }

      console.log(`🔍 AuthService.login: Resultado de búsqueda:`, {
        found: !!user,
        email: user?.email,
        emailMatch: user?.email === email.toLowerCase(),
        hasPassword: !!user?.password,
        passwordLength: user?.password?.length || 0,
        isActive: user?.isActive,
        isDeleted: user?.isDeleted,
        hasOrganization: !!user?.organization
      });

      if (!user) {
        console.log(`❌ AuthService.login: Usuario no encontrado: ${email}`);
        throw new Error('Credenciales inválidas');
      }

      // Verificar que el usuario tenga contraseña
      if (!user.password) {
        console.log(`❌ AuthService.login: Usuario sin contraseña: ${email}`);
        throw new Error('Credenciales inválidas - cuenta no configurada correctamente');
      }

      // Verificar si la cuenta está bloqueada
      if (user.security.accountLockedUntil && user.security.accountLockedUntil > Date.now()) {
        console.log(`🔒 AuthService.login: Cuenta bloqueada hasta: ${user.security.accountLockedUntil}`);
        throw new Error('Cuenta temporalmente bloqueada por múltiples intentos fallidos');
      }

      // Verificar contraseña
      console.log(`🔐 AuthService.login: Verificando contraseña para: ${email}`);
      console.log(`🔍 AuthService.login: Detalles de verificación:`, {
        providedPassword: password,
        providedPasswordLength: password.length,
        storedPasswordHash: user.password.substring(0, 20) + '...',
        storedPasswordLength: user.password.length,
        hashStartsWith: user.password.substring(0, 4)
      });
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      console.log(`🔍 AuthService.login: Resultado verificación contraseña:`, {
        isValid: isPasswordValid,
        providedPasswordLength: password.length,
        storedPasswordLength: user.password.length
      });
      
      if (!isPasswordValid) {
        console.log(`❌ AuthService.login: Contraseña inválida para: ${email}`);
        
        // Incrementar intentos fallidos
        await this._handleFailedLogin(user);
        
        throw new Error('Credenciales inválidas');
      }

      // Login exitoso - limpiar intentos fallidos
      await this._handleSuccessfulLogin(user, ipAddress);

      // Generar tokens
      const tokens = await this._generateTokens(user);

      // Preparar datos del usuario para respuesta
      const userData = {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        organization: {
          id: user.organization._id,
          name: user.organization.name,
          type: user.organization.type,
          sector: user.organization.sector
        },
        preferences: user.preferences,
        emailVerified: user.security.emailVerified,
        lastLogin: user.security.lastLogin
      };

      console.log(`✅ AuthService.login: Login exitoso para ${email}`);

      return {
        status: 'success',
        message: 'Login exitoso',
        data: {
          user: userData,
          tokens: {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            token_type: 'Bearer',
            expires_in: 24 * 60 * 60 // 24 horas en segundos
          }
        }
      };

    } catch (error) {
      console.log(`💥 AuthService.login: Error para ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Registrar organización con usuario admin
   * @param {Object} organizationData 
   * @param {Object} userData 
   * @returns {Object} Resultado del registro
   */
  async registerOrganizationWithAdmin(organizationData, userData) {
    try {
      console.log(`📋 AuthService.registerOrganization: Iniciando para ${userData.email}`);

      // Verificar que el email no esté en uso
      const existingUser = await User.findOne({ 
        email: userData.email.toLowerCase() 
      });

      if (existingUser) {
        throw new Error('El email ya está registrado en el sistema');
      }

      // Verificar que el RUC no esté en uso
      const existingOrg = await Organization.findOne({ 
        ruc: organizationData.ruc 
      });

      if (existingOrg) {
        throw new Error('El RUC ya está registrado en el sistema');
      }

      // Crear organización
      const organization = new Organization({
        name: organizationData.name.trim(),
        ruc: organizationData.ruc,
        type: organizationData.type,
        sector: organizationData.sector,
        size: organizationData.size,
        country: organizationData.country || 'Ecuador',
        city: organizationData.city || '',
        address: organizationData.address || '',
        website: organizationData.website || '',
        description: organizationData.description || ''
      });

      await organization.save();

      // Hash de la contraseña
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Crear usuario administrador
      const user = new User({
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        profile: {
          firstName: userData.profile.firstName.trim(),
          lastName: userData.profile.lastName.trim(),
          phone: userData.profile.phone || '',
          avatar: userData.profile.avatar || ''
        },
        role: 'admin', // Primer usuario es admin
        organization: organization._id,
        security: {
          emailVerified: false,
          lastLogin: null,
          lastLoginIP: '',
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          lastActivity: new Date()
        },
        preferences: {
          language: 'es',
          notifications: true,
          theme: 'light'
        }
      });

      await user.save();

      // Generar tokens
      const tokens = await this._generateTokens(user);

      // Preparar datos para respuesta
      const userData_response = {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        organization: {
          id: organization._id,
          name: organization.name,
          type: organization.type,
          sector: organization.sector
        },
        preferences: user.preferences
      };

      console.log(`✅ AuthService.registerOrganization: Registro exitoso para ${userData.email}`);

      return {
        status: 'success',
        message: 'Organización y usuario registrados exitosamente',
        data: {
          user: userData_response,
          organization: {
            id: organization._id,
            name: organization.name,
            type: organization.type,
            ruc: organization.ruc
          },
          tokens: {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            token_type: 'Bearer',
            expires_in: 24 * 60 * 60
          }
        }
      };

    } catch (error) {
      console.log(`💥 AuthService.registerOrganization: Error:`, error.message);
      throw error;
    }
  }

  /**
   * Cambiar contraseña
   * @param {string} userId 
   * @param {string} currentPassword 
   * @param {string} newPassword 
   * @returns {Object} Resultado del cambio
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Hash de la nueva contraseña
      const salt = await bcrypt.genSalt(12);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);

      // Actualizar contraseña
      user.password = hashedNewPassword;
      await user.save();

      return {
        status: 'success',
        message: 'Contraseña actualizada exitosamente'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Generar token de reset de contraseña
   * @param {string} email 
   * @returns {Object} Resultado
   */
  async generatePasswordResetToken(email) {
    try {
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        // Por seguridad, no revelar si el email existe o no
        return {
          status: 'success',
          message: 'Si el email existe, se enviará un enlace de recuperación'
        };
      }

      // Generar token de reset
      const resetToken = user.createPasswordResetToken();
      await user.save();

      // TODO: Implementar envío de email
      
      return {
        status: 'success',
        message: 'Si el email existe, se enviará un enlace de recuperación',
        resetToken: resetToken // Solo para desarrollo
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset de contraseña con token
   * @param {string} token 
   * @param {string} newPassword 
   * @returns {Object} Resultado
   */
  async resetPassword(token, newPassword) {
    try {
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        'security.passwordResetToken': hashedToken,
        'security.passwordResetExpires': { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Token inválido o expirado');
      }

      // Hash de la nueva contraseña
      const salt = await bcrypt.genSalt(12);
      const hashedNewPassword = await bcrypt.hash(newPassword, salt);

      // Actualizar contraseña y limpiar token
      user.password = hashedNewPassword;
      user.security.passwordResetToken = undefined;
      user.security.passwordResetExpires = undefined;
      
      await user.save();

      return {
        status: 'success',
        message: 'Contraseña restablecida exitosamente'
      };

    } catch (error) {
      throw error;
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Generar tokens JWT
   * @param {Object} user 
   * @returns {Object} Tokens
   */
  async _generateTokens(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organization._id || user.organization
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Manejar login fallido
   * @param {Object} user 
   */
  async _handleFailedLogin(user) {
    user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;

    // Bloquear cuenta después de 5 intentos fallidos
    if (user.security.failedLoginAttempts >= 5) {
      user.security.accountLockedUntil = Date.now() + (2 * 60 * 60 * 1000); // 2 horas
      console.log(`🔒 Cuenta bloqueada para: ${user.email} hasta ${new Date(user.security.accountLockedUntil)}`);
    }

    await user.save();
  }

  /**
   * Manejar login exitoso
   * @param {Object} user 
   * @param {string} ipAddress 
   */
  async _handleSuccessfulLogin(user, ipAddress) {
    user.security.lastLogin = new Date();
    user.security.lastLoginIP = ipAddress;
    user.security.lastActivity = new Date();
    user.security.failedLoginAttempts = 0;
    user.security.accountLockedUntil = undefined;

    await user.save();
  }
}

module.exports = new AuthService();