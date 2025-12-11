import 'fastify';

declare module 'fastify' {
    interface FastifyReply {
        /**
         * Render a view with @fastify/view
         */
        view(page: string, data?: object): Promise<string>;
        view<T extends object>(page: string, data?: T): Promise<string>;
    }
}
