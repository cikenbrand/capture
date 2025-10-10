import ProjectFileExplorerWindowBar from "./components/project-file-explorer/ProjectFileExplorerWindowBar";
import DivesExplorer from "./components/project-file-explorer/DivesExplorer";
import "@cubone/react-file-manager/dist/style.css";

export default function ExportProject () {
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <ProjectFileExplorerWindowBar/>
            <div className='flex-1 min-h-0 overflow-hidden'>
                <DivesExplorer/>
            </div>
        </div>
    )
}