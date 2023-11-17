import fs from "fs";
import path from "path";

import matter from "gray-matter";

interface ResultInterface extends Array<Directory | File> {}

interface EntryReference {
  type: "directories" | "files";
  id: string;
}

interface AdditionalAttributes {
  [key: string]: unknown;
}

interface Directory {
  type: "directories";
  id: string;
  attributes: {
    depth: number;
  } & AdditionalAttributes;
  relationships: {
    children: {
      data: EntryReference[];
    };
  };
}

interface File {
  type: "files";
  id: string;
  attributes: {
    depth: number;
  } & AdditionalAttributes;
}

interface EntryCallback {
  (
    entry: fs.Dirent,
    entryPath: string,
    relativePath: string
  ): Promise<AdditionalAttributes>;
}

const scanDirectoryStructure = async (
  dir: string,
  match: RegExp = /.*/,
  fileCallback: EntryCallback = async () => Promise.resolve({}),
  directoryCallback: EntryCallback = async () => Promise.resolve({})
): Promise<ResultInterface> => {
  const results = [] as ResultInterface;
  const baseDir = path.join(__dirname, dir);

  const recursiveScan = async (
    currentPath: string,
    depth: number = 0,
    parentRelativePath: string = ""
  ): Promise<EntryReference[]> => {
    const entries = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });
    const innerResults: EntryReference[] = [];

    await Promise.all(
      [...entries].map(async (entry) => {
        const entryPath = path.join(currentPath, entry.name);
        const relativePath = path.join(parentRelativePath, entry.name);

        if (match.exec(relativePath)) {
          if (entry.isFile()) {
            const fileAttributes = await fileCallback(
              entry,
              entryPath,
              relativePath
            );

            results.push({
              type: "files",
              id: relativePath,
              attributes: {
                ...fileAttributes,
                depth: depth,
              },
            });

            innerResults.push({
              type: "files",
              id: relativePath,
            });
          } else if (entry.isDirectory()) {
            const children = await recursiveScan(
              entryPath,
              depth + 1,
              relativePath
            );
            const directoryAttributes = await directoryCallback(
              entry,
              entryPath,
              relativePath
            );

            results.push({
              type: "directories",
              id: relativePath,
              attributes: {
                ...directoryAttributes,
                depth: depth,
              },
              relationships: {
                children: {
                  data: children,
                },
              },
            });

            innerResults.push({ type: "directories", id: relativePath });
          }
        }
      })
    );

    return innerResults;
  };

  await recursiveScan(baseDir, 0, "");
  return results;
};

const getChildrenFromDirectories = async (
  fileList: ResultInterface,
  dirs: Directory[],
  withTypes: "files" | "directories" | "all" = "all",
  withChildren: boolean = true
): Promise<(File | Directory)[]> => {
  return dirs.reduce(async (prevPromise, cur) => {
    const prev = await prevPromise;

    const results = [] as ResultInterface;
    const children = cur.relationships.children.data;

    await Promise.all(
      children.map(async (child) => {
        const findItemData = fileList.filter(
          (item) => item.id === child.id
        ) as unknown;

        if (child.type === "files" && withTypes !== "directories") {
          results.push(...(findItemData as File[]));
        }
        if (child.type === "directories" && withTypes !== "files") {
          results.push(...(findItemData as Directory[]));
        }
        if (child.type === "directories" && withChildren) {
          results.push(
            ...(await getChildrenFromDirectories(
              fileList,
              findItemData as Directory[],
              withTypes,
              withChildren
            ))
          );
        }
      })
    );

    return [...prev, ...results];
  }, Promise.resolve([] as ResultInterface));
};

void (async () => {
  const fileList1 = await scanDirectoryStructure("content", /.*[^.jpg]$/);
  console.dir("result1");
  console.dir(fileList1, { depth: null });
  console.dir("----------");

  const fileList2 = await scanDirectoryStructure("content/child", /.*[^.jpg]$/);
  console.dir("result2");
  console.dir(fileList2, { depth: null });
  console.dir("----------");

  const fileList3 = await scanDirectoryStructure("content/child", /.*[^.jpg]$/);
  console.dir("result3");
  console.dir(
    fileList3.filter((item) => item.type === "files"),
    { depth: null }
  );
  console.dir("----------");

  const fileList4 = await scanDirectoryStructure(
    "content",
    /.*[^.jpg]$/,
    async (entry, entryPath, relativePath) => {
      const stats = await fs.promises.stat(entryPath);
      const fileData = await fs.promises.readFile(entryPath, "utf-8");
      const { data, content } = matter(fileData);

      const trimExtensionRegex = /^(.+?)(\.[^.]*$|$)/;
      const fileMatch = trimExtensionRegex.exec(entry.name);
      const pathMatch = trimExtensionRegex.exec(relativePath);

      return {
        name: fileMatch?.[1] ?? "",
        extension: fileMatch?.[2] ?? "",
        pathArray: pathMatch?.[1].split("/"),
        timestamps: {
          created: stats.birthtime,
          modified: stats.mtime,
        },
        data,
        content,
      };
    },
    async (entry, _, relativePath) => {
      const trimExtensionRegex = /^(.+?)(\.[^.]*$|$)/;
      const pathMatch = trimExtensionRegex.exec(relativePath);

      return {
        name: entry.name,
        pathArray: pathMatch?.[1].split("/"),
      };
    }
  );
  console.dir("result4");
  console.dir(fileList4, { depth: null });
  console.dir("----------");

  const fileList5 = await scanDirectoryStructure(
    "content",
    /.*[^.jpg]$/,
    async (entry, entryPath, relativePath) => {
      const stats = await fs.promises.stat(entryPath);
      const fileData = await fs.promises.readFile(entryPath, "utf-8");
      const { data, content } = matter(fileData);

      const trimExtensionRegex = /^(.+?)(\.[^.]*$|$)/;
      const fileMatch = trimExtensionRegex.exec(entry.name);
      const pathMatch = trimExtensionRegex.exec(relativePath);

      return {
        name: fileMatch?.[1] ?? "",
        extension: fileMatch?.[2] ?? "",
        pathArray: pathMatch?.[1].split("/"),
        timestamps: {
          created: stats.birthtime,
          modified: stats.mtime,
        },
        data,
        content,
      };
    },
    async (entry, _, relativePath) => {
      const trimExtensionRegex = /^(.+?)(\.[^.]*$|$)/;
      const pathMatch = trimExtensionRegex.exec(relativePath);

      return {
        name: entry.name,
        pathArray: pathMatch?.[1].split("/"),
      };
    }
  );
  const targetDir5 = fileList4.filter(
    (item) => item.id === "child"
  ) as Directory[];
  console.dir("result5");
  console.dir(
    await getChildrenFromDirectories(fileList5, targetDir5, "all", true),
    { depth: null }
  );
  console.dir("----------");
})();
