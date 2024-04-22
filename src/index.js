const express = require('express');
const morgan = require('morgan');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session');
const passport = require('passport');
const flash = require('connect-flash');
const { database } = require('./keys');
const bodyParser = require('body-parser');
var favicon = require('serve-favicon');

//Inicializaciones
const app = express();
require('./lib/passport');

//Settings 
app.set('port', process.env.PORT || 4003);
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./lib/handlebars')
}));
app.set('view engine', '.hbs');

//Middlewares
app.use(morgan('dev'));
app.use(bodyParser.json({limit: '50mb', extended: true}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(bodyParser.text({ limit: '200mb' }));
app.use(session({
    secret: 'mysqlnodesession',
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore(database)
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

//Global Varibles
app.use((req, res, next) => {
    app.locals.success = req.flash('success');
    app.locals.danger = req.flash('danger');
    app.locals.user = req.user;
    next();
});

//Routes
app.use(require('./routes'));
app.use(require('./routes/authentication'));
app.use('/imputaciones', require('./routes/imputaciones'));
app.use('/imputaciones', require('./routes/calidadAgua'));
app.use('/imputaciones', require('./routes/registrosDeUsuarios'));
app.use('/imputaciones', require('./routes/administrarComunidades'));

//Public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'favicon')));
app.use(express.static('public'));

//Starting the server
app.listen(app.get('port'), () => {
    console.log('Server on port', app.get('port'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});



