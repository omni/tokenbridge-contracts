module.exports = {
    resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
    },
    module: {
    rules: [
    {
    test: /\\.(js|ts)x?$/,
    loader: 'babel-loader',
    exclude: /node_modules/
    },
    ]
    }
    
    };