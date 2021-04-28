import express from 'express'
import http from 'http'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import bcrypt from 'bcrypt'
import passport from 'passport'
import passportLocal from 'passport-local'


const app = express()

app.use(cookieParser())
app.use(session({
    store: MongoStore.create({ 
        //En Atlas connect App: Make sure to change the node version to 2.2.12:
        // mongodb://localhost:27017/ecommerce
        mongoUrl: 'mongodb+srv://usuario0:usuario0123@cluster0.3y0bt.mongodb.net/session?retryWrites=true&w=majority',
        // mongoUrl: 'mongodb://localhost:27017/ecommerce',
        mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true },
        ttl: 600
    }),
    secret: 'shhhhhhhhhhhhhhhhhhhhh',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 600000
    }
}))

app.use(passport.initialize());
app.use(passport.session());

const LocalStrategy = passportLocal.Strategy
// import UsersMongoDB from '../db/users.js'
// import {users as Users } from '../db/model.js'
// import {users as Users} from './db/model';
import { users as Users } from './db/model.js';


const isValidPassword = (user, password) => {
    return bcrypt.compareSync(password, user.password);
}

passport.use('login', new LocalStrategy({
    passReqToCallback: true
    },
    function(req, username, password, done){
        Users.findOne({'username': username},
        function(err, user) {
            if (err)
                return done(err);
            if (!user){
                console.log('User not found with username ' + username);
                return done(null, false, console.log('message', 'User not found'))
            } 
            if (!isValidPassword(user, password)){
                console.log('Invalid Password');
                return done(null, false, console.log('message', 'Invalid Password'))
            }
            return done(null, user)
            }
        )
    })
)

const createHash = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

passport.use('signup', new LocalStrategy({
    passReqToCallback: true
    },
    function(req, username, password, done){
        findOrCreateUser = function(){

            Users.findOne({'username': username},
            function(err, user) {
                if (err){
                    console.log('Error in Sign Up: ' +err)
                    return done(err);
                }
                if (user){
                    console.log('User already exists');
                    return done(null, false, console.log('message', 'User already exists'))
                } else {
                    var newUser = new Users()
                    newUser.username = username;
                    newUser.password = createHash(password)

                    newUser.save( (err)=> {
                        if (err){
                            console.log('Error while saving new user in DB', err)
                            throw err
                        }
                        console.log('New user successfully saved in DB')
                        return done(null, newUser)
                    })
                }
            })
        }
        process.nextTick(findOrCreateUser)
    })
)


passport.serializeUser((user, done) => {
    done(null, user._id)
})

passport.deserializeUser((id, done) => {
    Users.findById(id, (err, user)=> {
        done(err, user)
    })
})


const getNombreSession = req => req.session.nombre? req.session.nombre: ''

const server = http.Server(app)

import { Server as Socket } from 'socket.io'
const io = new Socket(server)

import handlebars from 'express-handlebars'
import Productos from './api/productos.js'
import Mensajes from './api/mensajes.js'
import { MongoDB } from './db/db.js'

let productos = new Productos()
let mensajes = new Mensajes()

import { getProdRandom } from './generador/productos.js'

//--------------------------------------------
//establecemos la configuración de handlebars
app.engine(
    "hbs",
    handlebars({
      extname: ".hbs",
      defaultLayout: 'index.hbs',
    })
);
app.set("view engine", "hbs");
app.set("views", "./views");
//--------------------------------------------

app.use(express.static('public'))

/* -------------------------------------------------------- */
/* -------------- LOGIN y LOGOUT DE USUARIO --------------- */
/* -------------------------------------------------------- */
app.use(express.urlencoded({extended: true}))

app.get('/login', (req,res) => {
    if(req.session.nombre) {
        res.render("home", {
            nombre: req.session.nombre
        })
    }
    else {
        res.sendFile(process.cwd() + '/public/login.html')
    }
})

app.post('/login', passport.authenticate('login', { failureRedirect: '/loginFailed'}), (req,res) => {
    // console.log(req.username)
    res.redirect('/')
})

app.get('/loginFailed', (req, res) => {
    console.log('Failed to log in')
    res.status(404).send('fail to login')
})

app.get('/logout', (req,res) => {
    let nombre = getNombreSession(req)
    if(nombre) {
        req.session.destroy( err => {
            if(!err) res.render("logout", { nombre })
            else res.redirect('/')
        })
    }
    else {
        res.redirect('/')
    }
})
/* -------------------------------------------------------- */
/* -------------------------------------------------------- */
/* -------------------------------------------------------- */

const router = express.Router()
app.use('/api', router)

router.use(express.json())
router.use(express.urlencoded({extended: true}))


router.get('/productos/listar', async (req,res) => {
    res.json(await productos.listarAll())
})

router.get('/productos/listar/:id', async (req,res) => {
    let { id } = req.params
    res.json(await productos.listar(id))
})

router.post('/productos/guardar', async (req,res) => {
    let producto = req.body
    await productos.guardar(producto)
    res.json(producto)
    //res.redirect('/')
})

router.put('/productos/actualizar/:id', async (req,res) => {
    let { id } = req.params
    let producto = req.body
    await productos.actualizar(producto,id)
    res.json(producto)
})

router.delete('/productos/borrar/:id', async (req,res) => {
    let { id } = req.params
    let producto = await productos.borrar(id)
    res.json(producto)
})

router.get('/productos/vista', async (req, res) => {
    let prods = await productos.listarAll()

    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

router.get('/productos/vista-test', async (req, res) => {

    let cant = req.query.cant || 10
    let prods = []
    for(let i=0; i<cant; i++) prods.push(getProdRandom(i+1))

    //console.log(prods)
    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

/* -------------------- Web Sockets ---------------------- */
io.on('connection', async socket => {
    console.log('Nuevo cliente conectado!');
    
    /* ------------------- */
    /* Info Productos (ws) */
    /* ------------------- */
    /* Envio los mensajes al cliente que se conectó */
    socket.emit('productos', await productos.get());

    /* Escucho los mensajes enviado por el cliente y se los propago a todos */
    socket.on('update', async data => {
        if(data = 'ok') {
            io.sockets.emit('productos',  await productos.get()); 
        }
    })

    /* ----------------------- */
    /* Centro de mensajes (ws) */
    /* ----------------------- */
    socket.emit('messages', await mensajes.getAll());

    socket.on('new-message', async function(data) {
        //console.log(data)
        await mensajes.guardar(data); 
        io.sockets.emit('messages', await mensajes.getAll()); 
    })    
});
/* ------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
const srv = server.listen(PORT, async () => {
    console.log(`Servidor http escuchando en el puerto ${srv.address().port}`)
    try {
        const mongo = new MongoDB('mongodb://localhost:27017/ecommerce')
        await mongo.conectar()
        console.log('base MongoDB conectada')
    }
    catch(error) {
        console.log(`Error en conexión de Base de datos: ${error}`)
    }
})
srv.on("error", error => console.log(`Error en servidor ${error}`))
