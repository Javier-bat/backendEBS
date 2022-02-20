const ExpressHelper = {

    get: (app, ruta, entidad, include) => {
        if (!include) {
            include = {}
        }
        app.get(ruta, (req, res) => {
            entidad.findAll(include).then(entidades => res.json(entidades));
        });
    },
    find: (app, ruta, entidad) => {
        app.get(ruta, (req, res) => {
            entidad.findAll().then(entidades => res.json(entidades));
        });
    },
    post: (app, ruta, entidad, propiedades) => {
        app.post(ruta, (req, res) => {
            var props = {};
            propiedades.forEach(element => {
                props[element] = req.body[element]
            });
            entidad.create(props).then(resultado => res.json(resultado));
        });
    },
    patch: (app, ruta, entidad, propiedades) => {
        app.patch(ruta, (req, res) => {
            var props = {};
            propiedades.forEach(element => {
                props[element] = req.body[element]
            });
            entidad.findByPk(req.params.id).then((ent) => {
                ent.update(props).then(resultado => res.json(resultado));
            });
        });
    },
    delete: (app, ruta, entidad) => {
        app.delete(ruta, (req, res) => {
            entidad.findByPk(req.params.id).then((ent) => {
                ent.destroy().then(resultado => res.sendStatus(200));
            });
        });
    },

}
export default ExpressHelper;