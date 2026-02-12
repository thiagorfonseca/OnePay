export const readJson = async <T = any>(req: any): Promise<T> => {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({} as T);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
};

export const json = (res: any, status: number, payload: any) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export const methodNotAllowed = (res: any, methods: string[]) => {
  res.setHeader('Allow', methods.join(', '));
  return json(res, 405, { error: 'Método não permitido.' });
};

export const badRequest = (res: any, message: string, details?: any) => {
  return json(res, 400, { error: message, details });
};

export const notFound = (res: any, message: string) => {
  return json(res, 404, { error: message });
};

export const unauthorized = (res: any, message: string) => {
  return json(res, 401, { error: message });
};

export const serverError = (res: any, message: string, details?: any) => {
  return json(res, 500, { error: message, details });
};
