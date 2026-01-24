class apiResponse {
    constructor(statusCode, message, data, success = true) {
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.success = success;
    }


}

export { apiResponse };