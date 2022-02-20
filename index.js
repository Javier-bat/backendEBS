import express from 'express';
import bodyParser from 'body-parser';
import Sequelize from 'sequelize';
import Helper from './ExpressHelper.js'
import cors from 'cors'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import expressJwt from 'express-jwt'

const app = express();
const dbName = 'buensabor';
const dbUsername = 'root';
const dbPassword = '';
const port = 3000;

const makeAbm = (app, ruta, entidad, atributos, include) => {
    Helper.get(app, ruta, entidad, include);
    Helper.post(app, ruta, entidad, atributos);
    Helper.patch(app, ruta + '/:id', entidad, atributos);
    Helper.delete(app, ruta + '/:id', entidad);
}
//Configuracion de express
app.use(bodyParser.json());
app.use(cors());
app.listen(port, () => console.log(`El buen sabor corriendo en el puerto ${port}!`));
//Configuracion de sequelize
let sequelize = new Sequelize(dbName, dbUsername, dbPassword, {
    host: 'localhost',
    dialect: 'mysql',
    logging: false
});

sequelize.authenticate().then(() => {
    console.log("Conectado a la base de datos con exito!");
}).catch((e) => {
    console.error("No se pudo conectar a la db");
});

//Modelos de sequelize
const factura = sequelize.define('Factura', {
    fecha: Sequelize.DATE,
    numero: Sequelize.INTEGER,
    montoDescuento: Sequelize.DOUBLE,
    total: Sequelize.DOUBLE
});

const pedido = sequelize.define('Pedido', {
    fecha: Sequelize.DATE,
    numero: Sequelize.INTEGER,
    estado: {
        type: Sequelize.ENUM,
        values: ['pendiente', 'en preparacion', 'entregado']
    },
    horaEstimadaFin: Sequelize.DATE,
    tipoEnvio: {
        type: Sequelize.ENUM,
        values: ['local', 'envio']
    }
});

const Cliente = sequelize.define('Cliente', {
    nombre: Sequelize.STRING,
    apellido: Sequelize.STRING,
    telefono: Sequelize.STRING,
    email: Sequelize.STRING
});

const DetallePedido = sequelize.define('DetallePedido', {
    cantidad: Sequelize.INTEGER,
    subtotal: Sequelize.DOUBLE
});

const ArticuloManufacturado = sequelize.define('ArticuloManufacturado', {
    tiempoEstimadoCocina: Sequelize.INTEGER,
    denominacion: Sequelize.STRING,
    precioVenta: Sequelize.DOUBLE
})

const Domicilio = sequelize.define('Domicilio', {
    calle: Sequelize.STRING,
    numero: Sequelize.INTEGER,
    localidad: Sequelize.STRING
});

const RubroArticulo = sequelize.define('RubroArticulo', {
    denominacion: Sequelize.STRING
});

const Articulo = sequelize.define('Articulo', {
    denominacion: Sequelize.STRING,
    precioCompra: Sequelize.DOUBLE,
    precioVenta: Sequelize.DOUBLE,
    stockActual: Sequelize.INTEGER,
    unidadMedida: Sequelize.STRING,
    esInsumo: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }
});

const ArticuloManufacturadoDetalle = sequelize.define('ArticuloManufacturadoDetalle', {
    cantidad: Sequelize.INTEGER
});

//Modelo agregado
const Usuario = sequelize.define('Usuario', {
    email: { type: Sequelize.STRING, unique: true },
    password: Sequelize.STRING,
    tipo: { type: Sequelize.ENUM, values: ['Cliente', 'Personal'], defaultValue: 'Cliente' }
})

//Relaciones
pedido.belongsTo(Cliente, { foreignKey: 'idCliente' });
factura.belongsTo(pedido, { foreignKey: 'idPedido' });
Cliente.hasOne(Domicilio, { foreignKey: 'idCliente' });
pedido.hasMany(DetallePedido, { foreignKey: 'idPedido' })
DetallePedido.belongsTo(Articulo, { foreignKey: 'idArticulo' })
DetallePedido.belongsTo(ArticuloManufacturado, { foreignKey: 'idArtManufacturado' })
//Este esta en duda,porque se puede navegar desde factura->pedido->detallePedido
//factura.hasMany(DetallePedido);
ArticuloManufacturado.hasMany(ArticuloManufacturadoDetalle, { foreignKey: 'idArtManufacturado' });
ArticuloManufacturadoDetalle.belongsTo(Articulo, { foreignKey: 'idArticulo' });
RubroArticulo.hasMany(Articulo, { foreignKey: 'idRubroArticulo' });

//Actualiza la tablas de la base de datos para que queden acorde a los modelos
sequelize.sync({ alter: true,force:true });

//Rutas (no creo que sirva para todos los casos, pero puede ahorrar mucho tiempo)
makeAbm(app, '/rubro-articulo', RubroArticulo, ['denominacion']);
makeAbm(app, '/cliente', Cliente, ['nombre', 'apellido', 'telefono', 'email', 'idDomicilio'], { include: Domicilio });
makeAbm(app, '/domicilio', Domicilio, ['calle', 'numero', 'localidad']);
makeAbm(app, '/articulo', Articulo, ['denominacion', 'precioCompra', 'precioVenta', 'stockActual', 'unidadMedida', 'esInsumo', 'idRubroArticulo']);
//makeAbm(app, '/pedido', pedido, ['id', 'fecha', 'numero', 'estado', 'horaEstimadaFin', 'tipoEnvio', 'idCliente'], { include: [Articulo, ArticuloManufacturado, Cliente] });
makeAbm(app, '/factura', factura, ['id', 'fecha', 'numero', 'montoDescuento', 'total', 'idPedido'], { include: [{ model: pedido, include: [{ model: Cliente, include: Domicilio }, { model: DetallePedido, include: [Articulo, ArticuloManufacturado] }] }] });
app.patch("/pedido/:id", (req, res) => {
    pedido.findByPk(req.params.id).then((ent) => {
        var estado = req.body.estado ? req.body.estado : ent.estado
        ent.update({ horaEstimadaFin: req.body.horaEstimadaFin, estado: estado }).then(resultado => res.json(resultado));
    });

    //makeAbm(app, '/pedido', pedido, ['id','fecha','numero','estado','horaEstimadaFin','tipoEnvio','idCliente'], { include: [{model: Cliente, include: Domicilio}, {model: DetallePedido, include: [Articulo,ArticuloManufacturado]}] });
    //makeAbm(app, '/factura', factura, ['id','fecha','numero','montoDescuento','total','idPedido'], { include: [{model: pedido, include: [{model: Cliente, include: Domicilio}, {model: DetallePedido, include: [Articulo,ArticuloManufacturado]}]}] });


});
app.get('/articulo/insumo', (req, res) => {
    Articulo.findAll({
        where: {
            esInsumo: true
        }
    }).then(entidades => res.json(entidades));
});

app.post('/articulo-manufacturado', (req, res) => {
    ArticuloManufacturado.create({ tiempoEstimadoCocina: req.body.tiempoEstimadoCocina, denominacion: req.body.denominacion, precioVenta: req.body.precioVenta }).then(art => {
        req.body.articulos.forEach(element => {
            ArticuloManufacturadoDetalle.create({ cantidad: element.cantidad, idArtManufacturado: art.id, idArticulo: element.idArticulo })
        });
        res.json(req.body)
    })

});

app.patch('/articulo-manufacturado/:id', (req, res) => {
    ArticuloManufacturado.findByPk(req.params.id).then(art => {
        art.update({ tiempoEstimadoCocina: req.body.tiempoEstimadoCocina, denominacion: req.body.denominacion, precioVenta: req.body.precioVenta }).then(updatedArt => {
            ArticuloManufacturadoDetalle.destroy({ where: { idArtManufacturado: updatedArt.id } }).then(data => {
                if (req.body.articulos.length == 0) {
                    res.json(req.body)
                    return
                }
                req.body.articulos.forEach((element, index) => {
                    ArticuloManufacturadoDetalle.create({ cantidad: element.cantidad, idArtManufacturado: updatedArt.id, idArticulo: element.idArticulo }).catch(e => console.log(e))
                    console.log(req.body.articulos.length)
                    if (index == (req.body.articulos.length - 1)) {
                        res.json(req.body)
                    }
                });

            }).catch(e => console.log(e))
        }).catch(e => console.log(e))
    }).catch(e => console.log(e))

});

app.get('/articulo-manufacturado', (req, res) => {
    ArticuloManufacturado.findAll({ include: [{ model: ArticuloManufacturadoDetalle, include: Articulo }] }).then(data => {
        res.json(data)
    })

});

app.get('/carta', (req, res) => {
    ArticuloManufacturado.findAll({
        /*raw: true,
        nest: true,*/ attributes: ['id', 'denominacion', 'precioVenta', "tiempoEstimadoCocina"], include: [{ model: ArticuloManufacturadoDetalle, include: Articulo }]
    }).then(data => {
        new Promise((resolve, reject) => {
            var newData = []
            data.forEach(element => {
                element.dataValues.esManufacturado = true;
                //element.dataValues.id = 
                newData.push(element)
            });
            resolve(newData)
        }).then((secondResult) => {
            Articulo.findAll({ where: { esInsumo: { [Sequelize.Op.not]: true, } }, attributes: ['id', 'denominacion', 'precioVenta'] }).then(arts => {
                res.json([...arts, ...secondResult])
            })
        })
        //res.json(data);
    })
})

//Registro
//Falta hashear la contrasena
//app.post("/usuario")
app.post('/registro', (req, res) => {
    Usuario.create({ email: req.body.email, password: req.body.password }).then((usuario) => {
        Cliente.create({ nombre: req.body.nombre, apellido: req.body.apellido, telefono: req.body.telefono, email: req.body.email }).then(cliente => {
            Domicilio.create({ calle: req.body.calle, numero: req.body.numero, localidad: req.body.localidad, idCliente: cliente.id }).then((domicilio) => {
                res.json(req.body);
            }).catch(e => res.status(409).json(e.errors[0].message))
        }).catch(e => res.status(409).json(e.errors[0].message))
    }).catch(e => res.status(409).json(e.errors[0].message))
});

app.post('/login', (req, res) => {
    Usuario.findOne({ where: { email: req.body.email } }).then(user => {
        if (user == null) {
            res.status(401).json({ error: "Usuario no registrado" })
            return;
        }
        if (user.password != req.body.password) {
            res.status(401).json({ error: "Contraseña incorrecta" })
            return;
        }
        var token = jwt.sign({ email: user.email, tipo: user.tipo, idCliente: user.id }, "secreto1234", { expiresIn: '96h' });
        res.json({ token: token });
    }).catch(e => {
        e => res.status(409).json(e.errors[0].message)
    })
})

//Pedidos
app.get('/pedido/actuales', (req, res) => {
    pedido.findAll({
        where: {
            estado: { [Sequelize.Op.ne]: 'entregado' }
        },
        include: { model: DetallePedido, include: [Articulo, ArticuloManufacturado] }
    }).then(data => {
        res.json(data)
    });
});

app.get('/pedidos', (req, res) => {
    pedido.findAll({
        include: [{ model: DetallePedido, include: [Articulo, ArticuloManufacturado] }, { model: Cliente, include: Domicilio }]
    }).then(data => {
        res.json(data)
    });
});

app.post("/pedido", (req, res) => {
    var date = new Date()
    date.setMinutes(date.getMinutes() - req.body.tiempoEstimado)


    pedido.create({ fecha: new Date(), estado: "Pendiente", horaEstimadaFin: date, tipoEnvio: req.body.tipoEnvio, idCliente: req.body.idCliente }).then(data => {
        new Promise((resolve, rejet) => {
            req.body.articulos.forEach((valor, index) => {
                new Promise((resolve, eject) => {
                    var objeto = { cantidad: valor.cantidad, subtotal: (valor.cantidad * valor.itemCarta.precioVenta), idPedido: data.id }
                    if (valor.itemCarta.esManufacturado) {
                        objeto.idArtManufacturado = valor.itemCarta.id
                        ArticuloManufacturado.findByPk(valor.itemCarta.id, { include: ArticuloManufacturadoDetalle }).then(artManu => {
                            artManu.dataValues.ArticuloManufacturadoDetalles.forEach((v, k) => {
                                console.log(artManu.dataValues.ArticuloManufacturadoDetalles)
                                Articulo.findByPk(v.dataValues.idArticulo).then(art => {
                                    art.update({ stockActual: Number(art.stockActual) - valor.cantidad * v.cantidad })
                                })
                            })

                        })
                        resolve(objeto)
                    } else {
                        objeto.idArticulo = valor.itemCarta.id
                        Articulo.findByPk(valor.itemCarta.id).then(dataTwo => {

                            dataTwo.update({ stockActual: Number(dataTwo.stockActual) - Number(valor.cantidad) }).then(data => {
                                resolve(objeto)
                            });
                        })


                    }

                }).then((result) => {
                    DetallePedido.create(result).then(data => { }).catch(e => console.log(e))
                })


            })
            resolve()
        }).then(() => {
            res.json(req.body)
        })
    })

})

app.get('/reportes/comidasMasPedidas', (req, res) => {
    sequelize.query("SELECT sum(cantidad) as total,articulomanufacturados.denominacion FROM `detallepedidos` INNER JOIN articulomanufacturados ON detallepedidos.idArtManufacturado = articulomanufacturados.id GROUP BY idArtManufacturado ORDER BY total ASC", { type: Sequelize.QueryTypes.SELECT }).then(data => {
        res.json(data)
    });
})

app.post('/reportes/pedidos/periodo', (req, res) => {
    let desde = req.body.desde, hasta = req.body.hasta;
    sequelize.query(`SELECT count(id) as pedidos,fecha from pedidos  ${(desde != "" && hasta != "" ? `WHERE fecha BETWEEN '${desde}' AND '${hasta}'` : ``)} group by fecha ORDER by fecha ASC`, { type: Sequelize.QueryTypes.SELECT }).then(data => {
        res.json(data)
    });
})

app.post('/reportes/pedidos/cliente', (req, res) => {
    let desde = req.body.desde, hasta = req.body.hasta;
    sequelize.query(`SELECT count(pedidos.id) as pedidos,fecha, clientes.nombre,clientes.apellido from pedidos INNER JOIN clientes ON clientes.id = pedidos.idCliente  ${(desde != "" && hasta != "" ? `WHERE fecha BETWEEN '${desde}' AND '${hasta}'` : `` )} group by idCliente ORDER by idCliente ASC`, { type: Sequelize.QueryTypes.SELECT }).then(data => {
        res.json(data)
    });
})

app.post('/reportes/cliente', (req, res) => {
    let desde = req.body.desde, hasta = req.body.hasta;
    sequelize.query(`SELECT count(clientes.id) as clientes, createdAt FROM clientes ${(desde != "" && hasta != "" ? `WHERE createdAt BETWEEN '${desde}' AND '${hasta}'` : ``)} group by createdAt ORDER by id ASC`, { type: Sequelize.QueryTypes.SELECT }).then(data => {
        res.json(data)
    });
})

app.post('/factura/pedido', (req, res) => {
    let idPedido = req.body.idPedido
    factura.findOne({
        where: {
            idPedido: idPedido
        },
        include: [{ model: pedido, include: [{ model: Cliente, include: Domicilio }, { model: DetallePedido, include: [Articulo, ArticuloManufacturado] }] }]
    }).then(data => {
        res.json(data)
    });
});

app.post('/reportes/ingresos', (req, res) => {
    let desde = req.body.desde, hasta = req.body.hasta;
    sequelize.query(`SELECT total,fecha from facturas  ${(desde != "" && hasta != "" ? `WHERE fecha BETWEEN '${desde}' AND '${hasta}'` : ``)} group by fecha ORDER by fecha ASC`, { type: Sequelize.QueryTypes.SELECT }).then(data => {
        res.json(data)
    });
});

app.get('/personal', (req, res) => {
    Usuario.findAll({
        where: {
            tipo: "Personal"
        }
    }).then(data => {
        res.json(data)
    });
});
app.post('/personal', (req, res) => {
    Usuario.create({ email: req.body.email, password: req.body.password, tipo: "Personal" }).then(data => {
        res.json(data)
    });
});

app.get('/pedido/:id', (req, res) => {
    pedido.findAll({
        where: { idCliente: req.params.id },
        include: [{ model: DetallePedido, include: [Articulo, ArticuloManufacturado] }, { model: Cliente, include: Domicilio }]
    }).then(data => {
        res.json(data)
    });
});






