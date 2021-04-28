import * as model from './model.js'

class UsersMongoDB {
    constructor() {}

    leer(username) {
        return username? 
            model.productos.find({username:username}) : 
            model.productos.find({})
    }
    
    guardar(username, password) {
        const productoModel = new model.users({username, password});
        return productoModel.save()
    }

    // actualizar(producto, id) {
    //     return model.productos.updateOne( {_id: id }, { $set: {...producto} })
    // }
    
    // borrar(id) {
    //     return model.productos.deleteOne( {_id: id })
    // }
}

export default UsersMongoDB
