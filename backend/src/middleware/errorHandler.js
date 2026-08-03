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

    // Format MySQL foreign key and duplicate entry errors
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
        err.statusCode = 400;
        err.message = 'Cannot delete this employee account because active drawings, QA/QC reports, or workflow logs are associated with it.';
        err.isOperational = true;
    } else if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        err.statusCode = 400;
        err.message = 'A record with this information already exists.';
        err.isOperational = true;
    }

    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    const responseMessage = err.message || 'Something went wrong!';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            success: false,
            message: responseMessage,
            error: err,
            stack: err.stack,
        });
    } else {
        // Production error handling
        res.status(err.statusCode).json({
            status: err.status,
            success: false,
            message: err.isOperational ? responseMessage : 'Something went wrong on the server.',
        });
    }
};

export default errorHandler;
