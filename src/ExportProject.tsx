import ProjectFileExplorerWindowBar from "./components/project-file-explorer/ProjectFileExplorerWindowBar";
import { useState } from "react";
import { FileManager } from "@cubone/react-file-manager";
import "@cubone/react-file-manager/dist/style.css";

export default function ExportProject () {
    const [files, setFiles] = useState([
        {
          name: "Documents",
          isDirectory: true, // Folder
          path: "/Documents", // Located in Root directory
          updatedAt: "2024-09-09T10:30:00Z", // Last updated time
        },
        {
          name: "Pictures",
          isDirectory: true,
          path: "/Pictures", // Located in Root directory as well
          updatedAt: "2024-09-09T11:00:00Z",
        },
        {
          name: "Pic.png",
          isDirectory: false, // File
          path: "/Pictures/Pic.png", // Located inside the "Pictures" folder
          updatedAt: "2024-09-08T16:45:00Z",
          size: 2048, // File size in bytes (example: 2 KB)
        },
      ]);

    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <ProjectFileExplorerWindowBar/>
            <FileManager 
                files={files} 
                style={{ 'backgroundColor': 'transparent', 'height': '100%', 'borderRadius': 0, 'border': 'none' }}
                permissions={{
                    create: false,
                    delete: false,
                    download: true,
                    copy: false,
                    move: true,
                    rename: true,
                    upload: false,
                  }}
                />
        </div>
    )
}