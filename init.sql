-- Script para crear base de datos y usuario para SIGNPOINT en SQL Server (localhost)
-- Asegúrate de ejecutarlo con privilegios suficientes (por ejemplo, como sa o un sysadmin)

-- 1. Crear la base de datos
IF DB_ID('SIGNPOINT') IS NULL
BEGIN
    CREATE DATABASE SIGNPOINT;
    PRINT 'Base de datos SIGNPOINT creada.';
END
ELSE
BEGIN
    PRINT 'La base de datos SIGNPOINT ya existe.';
END
GO

-- 2. Crear el usuario de login a nivel de servidor
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'signpoint')
BEGIN
    CREATE LOGIN signpoint WITH PASSWORD = 'SignP01ntPass!';
    PRINT 'Login [signpoint] creado.';
END
ELSE
BEGIN
    PRINT 'El login [signpoint] ya existe.';
END
GO

-- 3. Crear el usuario de la base de datos y asignarle permisos
USE SIGNPOINT;
GO

IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'signpoint')
BEGIN
    CREATE USER signpoint FOR LOGIN signpoint;
    PRINT 'Usuario [signpoint] creado en la base SIGNPOINT.';
END
ELSE
BEGIN
    PRINT 'El usuario [signpoint] ya existe en la base SIGNPOINT.';
END
GO

-- 4. Otorgar permisos/requerir roles (db_owner, puedes ajustar a tu necesidad)
ALTER ROLE db_owner ADD MEMBER signpoint;
PRINT 'El usuario [signpoint] agregado al rol db_owner.';
GO

-- 5. (Opcional) Mostrar datos de conexión
PRINT 'Conexión recomendada:';
PRINT 'Server=localhost,1433;Database=SIGNPOINT;User Id=signpoint;Password=SignP01ntPass!;Encrypt=False;';
GO
