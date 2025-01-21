export const getNetlifyConfig = () => {
  return `
        [functions]
        external_node_modules = ["express", "serverless-http"]
        node_bundler = "esbuild"
        directory = "/"
        [[redirects]]
        force = true
        from = "/*"
        status = 200
        to = "/.netlify/functions/api/:splat"
        `;
};
