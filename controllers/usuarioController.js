import { check, validationResult } from "express-validator"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

import Usuario from "../models/Usuario.js"
import { generarJWT, generarId } from "../helpers/tokens.js"
import { emailRegistro, emailOlvidePassword } from "../helpers/emails.js"


const formularioLogin = (req, res) => {
    res.render('auth/login', {
        pagina: 'Iniciar Sesion',
        csrfToken: req.csrfToken(),
    })
}

const autenticar = async (req, res) => {
    //validacion

    await check('email').isEmail().withMessage('El email es obligatorio').run(req)
    await check('password').notEmpty().withMessage('El Password es Obligatorio').run(req)

    let resultado = validationResult(req)

    //verificar que el resultado este vacio

    if (!resultado.isEmpty()) {
        //Errores

        return res.render('auth/login', {
            pagina: 'Iniciar Sesion',
            csrfToken: req.csrfToken(),
            errores: resultado.array(),
        })
    }


    const { email, password } = req.body
    //Comprobar si el usuario existe

    const usuario = await Usuario.findOne({ where: { email } })

    if (!usuario) {
        return res.render('auth/login', {
            pagina: 'Iniciar Sesion',
            csrfToken: req.csrfToken(),
            errores: [{ msg: 'El usuario no existe' }],
        })
    }

    //comprobar si el usuario esta confirmado

    if (!usuario.confirmado) {
        return res.render('auth/login', {
            pagina: 'Iniciar Sesion',
            csrfToken: req.csrfToken(),
            errores: [{ msg: 'Tu cuenta no ha sido confirmada' }],
        })
    }

    //revisar el password

    if (!usuario.verificarPassword(password)) {
        return res.render('auth/login', {
            pagina: 'Iniciar Sesion',
            csrfToken: req.csrfToken(),
            errores: [{ msg: 'El Password es incorrecto' }],
        })
    }

    //autenticar al usuario

    const token = generarJWT({ id: usuario.id, nombre: usuario.nombre })


    //almacenar en un cookie

    return res.cookie('_token', token, {
        httpOnly: true,
        // secure:true,
        // sameSite:true,
    }).redirect('/mis-propiedades')

}

const cerrarSesion = (req, res) => {
    return res.clearCookie('_token').status(200).redirect('/auth/login')
}

const formularioRegistro = (req, res) => {
    res.render('auth/registro', {
        pagina: 'Crear cuenta',
        csrfToken: req.csrfToken()

    })
}

const registrar = async (req, res) => {
    //validacion
    await check('nombre').notEmpty().withMessage('El nombre es obligatorio').run(req)
    await check('email').isEmail().withMessage('Eso no parece un email').run(req)
    await check('password').isLength({ min: 6 }).withMessage('El password debe de ser de al menos 6 caracteres').run(req)
    await check('repetir_password').equals(req.body.password).withMessage('Los password no son iguales').run(req)

    let resultado = validationResult(req)

    //verificar que el resultado este vacio

    if (!resultado.isEmpty()) {
        //Errores

        return res.render('auth/registro', {
            pagina: 'Crear Cuenta',
            csrfToken: req.csrfToken(),
            errores: resultado.array(),
            usuario: {
                nombre: req.body.nombre,
                email: req.body.email
            }
        })
    }
    //extraer los datos

    const { nombre, email, password } = req.body

    //verificar que el usuario no este duplicado

    const existeUsuario = await Usuario.findOne({ where: { email: email } })

    if (existeUsuario) {
        return res.render('auth/registro', {
            pagina: 'Crear Cuenta',
            csrfToken: req.csrfToken(),
            errores: [{ msg: 'El usuario ya esta registrado' }],
            usuario: {
                nombre: req.body.nombre,
                email: req.body.email
            }
        })
    }

    //almacenar un usuario
    const usuario = await Usuario.create({
        nombre,
        email,
        password,
        token: generarId(),
    })

    // envia email de confirmacion

    emailRegistro({
        nombre: usuario.nombre,
        email: usuario.email,
        token: usuario.token
    })

    //mostrando mensaje de confirmacion
    res.render('templates/mensaje', {
        pagina: 'Cuenta creada correctamente',
        mensaje: 'Hemos enviado un email de confirmacion preciona el enlace'
    })

}

//funcion que comprueba una cuenta

const confirmar = async (req, res) => {

    const { token } = req.params

    //verificar si el token es valido

    const usuario = await Usuario.findOne({ where: { token } })

    if (!usuario) {
        return res.render('auth/confirmar-cuenta', {

            pagina: 'Error al confirmar tu cuenta',
            mensaje: 'Hubo un error al confirmar tu cuenta intenta de nuevo',
            error: true
        })
    }

    //confirmar la cuenta

    usuario.token = null;
    usuario.confirmado = true;
    await usuario.save();

    res.render('auth/confirmar-cuenta', {

        pagina: 'Cuenta Confirmada',
        mensaje: 'La cuenta se confirmo correctamente',
    })


}

const formularioOlvidePassword = (req, res) => {
    res.render('auth/olvide-password', {
        pagina: 'Recupera Tu Acceso aBienes Raices',
        csrfToken: req.csrfToken(),

    })
}

const resetPassword = async (req, res) => {

    //validacion
    await check('email').isEmail().withMessage('Eso no parece un email').run(req)

    let resultado = validationResult(req)

    // return res.json(resultado.array())
    //verificar que el resultado este vacio

    if (!resultado.isEmpty()) {
        //Errores

        return res.render('auth/olvide-password', {
            pagina: 'Recupera Tu Acceso aBienes Raices',
            csrfToken: req.csrfToken(),
            errores: resultado.array(),
        })
    }

    //Buscar el usuario

    const { email } = req.body

    const usuario = await Usuario.findOne({ where: { email } })

    if (!usuario) {
        return res.render('auth/olvide-password', {
            pagina: 'Recupera Tu Acceso aBienes Raices',
            csrfToken: req.csrfToken(),
            errores: [{ msg: 'El email no pertenece a ningun usuario' }],
        })
    }

    // generar un token y enviar el email

    usuario.token = generarId();
    await usuario.save();

    //enviar un email

    emailOlvidePassword({
        email: usuario.email,
        nombre: usuario.nombre,
        token: usuario.token
    })


    //renderizar un mensaje de confirmacion

    res.render('templates/mensaje', {
        pagina: 'Reestablece tu Password',
        mensaje: 'Hemos enviado un email con las instrucciones'
    })
}

const comprobarToken = async (req, res) => {

    const { token } = req.params;

    const usuario = await Usuario.findOne({ where: { token } })

    if (!usuario) {
        return res.render('auth/confirmar-cuenta', {

            pagina: 'Reestablece tu Password',
            mensaje: 'Hubo un error al Validar tu informacion, Intenta de nuevo',
            error: true
        })
    }

    //Mostrar Formulario para modificar el password

    res.render('auth/reset-password', {
        pagina: 'Reestablece tu Password',
        csrfToken: req.csrfToken(),
    })
}

const nuevoPassword = async (req, res) => {
    //validar el password

    await check('password').isLength({ min: 6 }).withMessage('El password debe de ser de al menos 6 caracteres').run(req)

    let resultado = validationResult(req)

    if (!resultado.isEmpty()) {
        //Errores

        return res.render('auth/reset-password', {
            pagina: 'Reestablece tu Password',
            csrfToken: req.csrfToken(),
            errores: resultado.array(),
        })
    }

    const { token } = req.params
    const { password } = req.body

    //identificar quien hace el cambio

    const usuario = await Usuario.findOne({ where: { token } })

    //hashear el nuevo password

    const salt = await bcrypt.genSalt(10)
    usuario.password = await bcrypt.hash(password, salt);

    usuario.token = null

    await usuario.save()

    res.render('auth/confirmar-cuenta', {
        pagina: 'Password Reestablecido',
        mensaje: 'El Password se Guardo Correctamente'
    })
}

export {
    formularioLogin,
    autenticar,
    cerrarSesion,
    formularioRegistro,
    registrar,
    confirmar,
    formularioOlvidePassword,
    resetPassword,
    comprobarToken,
    nuevoPassword,


}
