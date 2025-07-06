const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { generateToken, generateRefreshToken } = require('../config/jwt');

class AuthService {
  // Add this method to your AuthService class

 

  async login(email, password, ipAddress) {
    try {
      // Buscar usuario por email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isDeleted: false 
      })
      .select('+password')
      .populate('organization', 'name type status');

      if (!user) {
        throw new Error('Credenciales inválidas');
      }

      // Verificar que la organización esté activa
      if (!user.organization || (user.organization.status && user.organization.status !== 'active')) {
        throw new Error('Organización inactiva');
      }

      // Verificar que el usuario esté activo
      if (!user.isActive) {
        throw new Error('Usuario inactivo');
      }

      // Verificar si la cuenta está bloqueada
      if (user.security.accountLockedUntil && user.security.accountLockedUntil > Date.now()) {
        throw new Error('Cuenta bloqueada temporalmente');
      }

      // Verificar contraseña
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Incrementar intentos fallidos
        user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
        
        // Bloquear cuenta después de 5 intentos fallidos
        if (user.security.failedLoginAttempts >= 5) {
          user.security.accountLockedUntil = Date.now() + 30 * 60 * 1000; // 30 minutos
        }
        
        await user.save({ validateBeforeSave: false });
        throw new Error('Credenciales inválidas');
      }

      // Login exitoso - limpiar intentos fallidos
      user.security.failedLoginAttempts = 0;
      user.security.accountLockedUntil = undefined;
      user.security.lastLogin = new Date();
      user.security.lastLoginIP = ipAddress;
      
      await user.save({ validateBeforeSave: false });

      // Generar tokens
      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
        organization: user.organization._id
      });

      const refreshToken = generateRefreshToken({
        id: user._id
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          role: user.role,
          organization: {
            id: user.organization._id,
            name: user.organization.name,
            type: user.organization.type
          },
          preferences: user.preferences,
          lastLogin: user.security.lastLogin,
          emailVerified: user.security.emailVerified
        },
        tokens: {
          access_token: token,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: '24h'
        }
      };

    } catch (error) {
      throw error;
    }
  }
  // Registrar nueva organización con usuario administrador
  async registerOrganizationWithAdmin(organizationData, userData) {
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Verificar que el RUC no esté registrado
      const existingOrg = await Organization.findOne({ ruc: organizationData.ruc });
      if (existingOrg) {
        throw new Error('El RUC ya está registrado');
      }

      // Verificar que el email no esté registrado
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      // Crear organización
      const organization = new Organization({
        ...organizationData,
        createdBy: null // Se asignará después de crear el usuario
      });
      await organization.save({ session });

      // Crear usuario administrador
      const user = new User({
        ...userData,
        role: 'admin',
        organization: organization._id,
        security: {
          emailVerified: false,
          emailVerificationToken: crypto.randomBytes(32).toString('hex')
        }
      });
      await user.save({ session });

      // Actualizar organización con el creador
      organization.createdBy = user._id;
      await organization.save({ session });

      await session.commitTransaction();

      // Generar tokens
      const token = generateToken({
        id: user._id,
        email: user.email,
        role: user.role,
        organization: organization._id
      });

      const refreshToken = generateRefreshToken({
        id: user._id
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          role: user.role,
          organization: {
            id: user.organization._id,
            name: user.organization.name,
            type: user.organization.type
          },
          preferences: user.preferences,
          lastLogin: user.security.lastLogin,
          emailVerified: user.security.emailVerified
        },
        tokens: {
          access_token: token,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: '24h'
        }
      };

    } catch (error) {
      throw error;
    }
  }

  // Crear usuario adicional en organización existente
  async createUser(userData, createdBy) {
    try {
      // Verificar que el email no esté registrado
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      // Verificar límites de la organización
      const organization = await Organization.findById(userData.organization);
      if (!organization) {
        throw new Error('Organización no encontrada');
      }

      const userCount = await User.countDocuments({
        organization: userData.organization,
        isActive: true,
        isDeleted: false
      });

      if (userCount >= organization.limits.maxUsers) {
        throw new Error(`Límite de usuarios alcanzado (${organization.limits.maxUsers})`);
      }

      // Crear usuario
      const user = new User({
        ...userData,
        security: {
          emailVerified: false,
          emailVerificationToken: crypto.randomBytes(32).toString('hex')
        }
      });

      await user.save();

      // Poblar organización
      await user.populate('organization', 'name type');

      return {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        organization: {
          id: user.organization._id,
          name: user.organization.name,
          type: user.organization.type
        },
        emailVerified: user.security.emailVerified,
        createdAt: user.createdAt
      };

    } catch (error) {
      throw error;
    }
  }

  // Cambiar contraseña
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Actualizar contraseña
      user.password = newPassword;
      await user.save();

      return { message: 'Contraseña actualizada exitosamente' };

    } catch (error) {
      throw error;
    }
  }

  // Generar token de reset de contraseña
  async generatePasswordResetToken(email) {
    try {
      const user = await User.findActiveByEmail(email);
      
      if (!user) {
        // Por seguridad, no revelar si el email existe
        return { message: 'Si el email existe, recibirá instrucciones de reset' };
      }

      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      return {
        resetToken,
        message: 'Token de reset generado'
      };

    } catch (error) {
      throw error;
    }
  }

  // Reset de contraseña
  async resetPassword(token, newPassword) {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const user = await User.findOne({
        'security.passwordResetToken': hashedToken,
        'security.passwordResetExpires': { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Token de reset inválido o expirado');
      }

      // Actualizar contraseña y limpiar token
      user.password = newPassword;
      user.security.passwordResetToken = undefined;
      user.security.passwordResetExpires = undefined;
      user.security.failedLoginAttempts = 0;
      user.security.accountLockedUntil = undefined;

      await user.save();

      return { message: 'Contraseña restablecida exitosamente' };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();