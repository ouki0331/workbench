import { createLibraryServer, defaultLibrary } from './library-server.mjs';
const directory = process.env.IELTS_LIBRARY_DIR || defaultLibrary;
const server = await createLibraryServer({ libraryDir: directory });
const port = Number(process.env.PORT || 3012);
server.listen(port, '127.0.0.1', () =>
  console.log(
    `IELTS local: http://localhost:${port}/\nStudy files: ${directory}`,
  ),
);
