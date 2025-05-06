import express, { Request, Response } from 'express';
import AWS from 'aws-sdk';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { createMetricsService } from './metrics';
import { v4 as uuidv4 } from 'uuid';

// Cargar variables de entorno
dotenv.config();

// Configuración de AWS
AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Configuración de tablas de DynamoDB
const DYNAMO_TABLE_CLIENTES = process.env.DYNAMO_TABLE_CLIENTES || 'examen-1-clientes';
const DYNAMO_TABLE_DOMICILIOS = process.env.DYNAMO_TABLE_DOMICILIOS || 'examen-1-domicilios';
const DYNAMO_TABLE_PRODUCTOS = process.env.DYNAMO_TABLE_PRODUCTOS || 'examen-1-producto';

// Inicializar Express
const app = express();
app.use(bodyParser.json());

// Métricas
const metricsService = createMetricsService();

// ENDPOINTS DE CLIENTES
app.post('/clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'POST /clientes';
    const { razonSocial, nombreComercial, correo } = req.body;
    const id = req.body.id || uuidv4();
    
    const params = {
        TableName: DYNAMO_TABLE_CLIENTES,
        Item: { id, razonSocial, nombreComercial, correo }
    };

    try {
        await dynamoDb.put(params).promise();
        res.status(201).json({ id, message: 'Cliente creado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.get('/clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'GET /clientes';
    const { id } = req.query;
    const params: any = {
        TableName: DYNAMO_TABLE_CLIENTES,
        KeyConditionExpression: "id = :id", 
        ExpressionAttributeValues: {
            ":id": id 
        }
    };

    try {
        const data = await dynamoDb.query(params).promise(); // Cambiado a query
        res.json(data.Items);
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener clientes', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.put('/clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'PUT /clientes';
    const { id, razonSocial, nombreComercial, correo } = req.body;

    const params = {
        TableName: DYNAMO_TABLE_CLIENTES,
        Key: { id },
        ExpressionAttributeValues: {
            ':razon': razonSocial,
            ':nombre': nombreComercial,
            ':correo': correo,
        },
        UpdateExpression: 'set razonSocial = :razon, nombreComercial = :nombre, correo = :correo',
        ReturnValues: 'UPDATED_NEW',
    };

    try {
        const result = await dynamoDb.update(params).promise();
        res.json({ message: 'Cliente actualizado', data: result.Attributes });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error actualizando cliente:', error);
        res.status(500).json({ error: 'Error actualizando cliente', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.delete('/clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'DELETE /clientes';
    const { id } = req.body;

    const params = {
        TableName: DYNAMO_TABLE_CLIENTES,
        Key: { id },
    };

    try {
        await dynamoDb.delete(params).promise();
        res.status(200).json({ message: 'Cliente eliminado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al eliminar cliente', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// ENDPOINTS DE DOMICILIOS
app.post('/domicilio-clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'POST /domicilio-clientes';
    const { clienteId, domicilio, colonia, municipio, estado, tipoDireccion } = req.body;
    const id = req.body.id || uuidv4();

    const tiposValidos = ["facturacion", "envio"];
    if (!tiposValidos.includes(tipoDireccion)) {
        res.status(400).json({ error: 'tipoDireccion debe ser facturacion o envio' });
        metricsService.incrementHttpCounter('4xx');
        return;
    }
    
    const params = {
        TableName: DYNAMO_TABLE_DOMICILIOS,
        Item: { id, clienteId, domicilio, colonia, municipio, estado, tipoDireccion }
    };

    try {
        await dynamoDb.put(params).promise();
        res.status(201).json({ id, message: 'Domicilio creado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al crear domicilio:', error);
        res.status(500).json({ error: 'Error al crear domicilio', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.get('/domicilio-clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'GET /domicilio-clientes';
    const { id, clienteId } = req.query;
    
    const params: any = {
        TableName: DYNAMO_TABLE_DOMICILIOS,
    };

    if (id) {
        params.KeyConditionExpression = "id = :id";
        params.ExpressionAttributeValues = {
            ":id": id
        };
    } else if (clienteId) {
        params.FilterExpression = "clienteId = :clienteId";
        params.ExpressionAttributeValues = {
            ":clienteId": clienteId
        };
    }

    try {
        const data = id ? await dynamoDb.query(params).promise() : await dynamoDb.scan(params).promise();
        res.json(data.Items);
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al obtener domicilios:', error);
        res.status(500).json({ error: 'Error al obtener domicilios', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.put('/domicilio-clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'PUT /domicilio-clientes';
    const { id, clienteId, domicilio, colonia, municipio, estado, tipoDireccion } = req.body;
    
    if (!id) {
        res.status(400).json({ error: 'ID es requerido' });
        metricsService.incrementHttpCounter('4xx');
        return;
    }
    const tiposValidos = ["facturacion", "envio"];
    if (!tiposValidos.includes(tipoDireccion)) {
        res.status(400).json({ error: 'tipoDireccion debe ser facturacion o envio' });
        metricsService.incrementHttpCounter('4xx');
        return;
    }

    const params = {
        TableName: DYNAMO_TABLE_DOMICILIOS,
        Key: { id },
        ExpressionAttributeValues: {
            ':clienteId': clienteId,
            ':domicilio': domicilio,
            ':colonia': colonia,
            ':municipio': municipio,
            ':estado': estado,
            ':tipoDireccion': tipoDireccion,
        },
        UpdateExpression: 'set clienteId = :clienteId, domicilio = :domicilio, colonia = :colonia, municipio = :municipio, estado = :estado, tipoDireccion = :tipoDireccion',
        ReturnValues: 'UPDATED_NEW',
    };

    try {
        const result = await dynamoDb.update(params).promise();
        res.json({ message: 'Domicilio actualizado', data: result.Attributes });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error actualizando domicilio:', error);
        res.status(500).json({ error: 'Error actualizando domicilio', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.delete('/domicilio-clientes', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'DELETE /domicilio-clientes';
    const { id } = req.body;

    const params = {
        TableName: DYNAMO_TABLE_DOMICILIOS,
        Key: { id },
    };

    try {
        await dynamoDb.delete(params).promise();
        res.status(200).json({ message: 'Domicilio eliminado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al eliminar domicilio:', error);
        res.status(500).json({ error: 'Error al eliminar domicilio', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// ENDPOINTS DE PRODUCTOS
app.post('/producto', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'POST /producto';
    const { nombre, unidadDeMedida, precioBase } = req.body;
    const id = req.body.id || uuidv4();

    const params = {
        TableName: DYNAMO_TABLE_PRODUCTOS,
        Item: { id, nombre, unidadDeMedida, precioBase }
    };

    try {
        await dynamoDb.put(params).promise();
        res.status(201).json({ id, message: 'Producto creado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ error: 'Error al crear producto', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.get('/producto', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'GET /producto';
    const { id } = req.query;

    const params: any = {
        TableName: DYNAMO_TABLE_PRODUCTOS,
    };

    if (id) {
        params.KeyConditionExpression = "id = :id";
        params.ExpressionAttributeValues = {
            ":id": id
        };
    }

    try {
        const data = id ? await dynamoDb.query(params).promise() : await dynamoDb.scan(params).promise();
        res.json(data.Items);
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.put('/producto', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'PUT /producto';
    const { id, nombre, unidadDeMedida, precioBase } = req.body;

    const params = {
        TableName: DYNAMO_TABLE_PRODUCTOS,
        Key: { id },
        ExpressionAttributeValues: {
            ':nombre': nombre,
            ':unidad': unidadDeMedida,
            ':precio': precioBase,
        },
        UpdateExpression: 'set nombre = :nombre, unidadDeMedida = :unidad, precioBase = :precio',
        ReturnValues: 'UPDATED_NEW',
    };

    try {
        const result = await dynamoDb.update(params).promise();
        res.json({ message: 'Producto actualizado', data: result.Attributes });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ error: 'Error actualizando producto', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

app.delete('/producto', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const endpoint = 'DELETE /producto';
    const { id } = req.body;

    const params = {
        TableName: DYNAMO_TABLE_PRODUCTOS,
        Key: { id },
    };

    try {
        await dynamoDb.delete(params).promise();
        res.status(200).json({ message: 'Producto eliminado' });
        metricsService.incrementHttpCounter('2xx');
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto', details: error });
        metricsService.incrementHttpCounter('5xx');
    } finally {
        const endTime = Date.now();
        metricsService.recordResponseTime(endTime - startTime, endpoint);
    }
});

// Iniciar servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servicio de catálogos ejecutándose en puerto ${port}`);
}); 