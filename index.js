// const express = require('express') //commonJS

import express from 'express'
import csrf from 'csurf'
import cookieParser from 'cookie-parser'

import usuarioRoutes from './routes/usuarioRoutes.js'
import propiedadesRoutes from './routes/propiedadesRoutes.js'
import appRoutes from './routes/appRoutes.js'
import apiRoutes from './routes/apiRoutes.js'
import db from './config/db.js'



//crear la app

const app = express()

//habilitar lectura de datos de formularios

app.use(express.urlencoded({ extended: true }))

//habilitar cookie parser

app.use(cookieParser())

//habilitar csrf

app.use(csrf({ cookie: true }))

//conexion a la base de datos

try {
    await db.authenticate();
    db.sync()
    console.log('Conexion correcta a la base de datos')
} catch (error) {
    console.log(error)
}

//Habilitar pug
app.set('view engine', 'pug')
app.set('views', './views')

//Carpeta publica 
app.use(express.static('public'))


//Routing
app.use('/', appRoutes)
app.use('/auth', usuarioRoutes)
app.use('/', propiedadesRoutes)
app.use('/api', apiRoutes)


//definir un puerto y arrancar el proyecto

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`el servidor esta funcionando en el puerto ${port}`)
});


