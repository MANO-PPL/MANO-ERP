const errorHandler = (err, req, res, next) => {
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            err.statusCode = 400;
            err.message = `Unexpected file upload field: '${err.field}'. Please use the correct field name (e.g., 'file').`;
            err.isOperational = true;
        } else {
            err.statusCode = 400;
            err.isOperational = true;
        }
    }

    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    } else {
        // Production error handling
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message,
            });
        } else {
            console.error('ERROR 💥', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went very wrong!',
            });
        }
    }
};

export default errorHandler;
