import { BiPlus } from "react-icons/bi";
import { useState } from "react";
import { DraggableDialog } from "@/components/ui/draggable-dialog";
import OverlayWindowBar from "./components/overlay-editor/OverlayWindowBar";
import CreateOverlayForm from "./components/overlay-editor/CreateOverlayForm";
import OverlayEditorCanvas from "./components/ui/OverlayEditorCanvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { MdDelete, MdEdit } from "react-icons/md";
import OverlayList from "./components/overlay-editor/OverlayList";
import RenameOverlayForm from "./components/overlay-editor/RenameOverlayForm";
import DeleteOverlayConfirmation from "./components/overlay-editor/DeleteOverlayConfirmation";
import { MdOutlineTextFields } from "react-icons/md";
import { FaFileImage } from "react-icons/fa";
import { IoIosTime } from "react-icons/io";
import { IoCalendar } from "react-icons/io5";
import { LuCable } from "react-icons/lu";
import { FaPersonSwimming } from "react-icons/fa6";
import { FaFolderTree } from "react-icons/fa6";
import ComponentList from "./components/overlay-editor/ComponentList";

export default function OverlayEditor() {
    const [newOverlayOpen, setNewOverlayOpen] = useState(false)
    const [renameOverlayOpen, setRenameOverlayOpen] = useState(false)
    const [deleteOverlayOpen, setDeleteOverlayOpen] = useState(false)
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
            <OverlayWindowBar />
            <div className="flex-1 flex p-2 gap-1">
                <div className="flex-none flex flex-col gap-1 h-full w-[300px]">
                    <Tabs defaultValue="overlay" className="h-full">
                        <TabsList>
                            <TabsTrigger value="overlay">Overlay</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overlay" className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <button onClick={() => setNewOverlayOpen(true)} title="New Overlay" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <BiPlus className="h-6 w-6" />
                                </button>
                                <button onClick={() => setRenameOverlayOpen(true)} title="Rename Overlay" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdEdit className="h-4.5 w-4.5" />
                                </button>
                                <button onClick={() => setDeleteOverlayOpen(true)} title="Delete Overlay" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdDelete className="h-4.5 w-4.5" />
                                </button>
                            </div>
                            <OverlayList />
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                    <Tabs defaultValue="editor" className="h-full">
                        <TabsList>
                            <TabsTrigger value="editor">Editor</TabsTrigger>
                        </TabsList>
                        <TabsContent value="editor" className="flex flex-col gap-1 p-0">
                            <div className="flex-none w-full h-[37px] bg-[#363D4A] flex items-center px-1 gap-1.5">
                                <button title="Custom Text" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdOutlineTextFields className="h-4.5 w-4.5" />
                                </button>
                                <button title="Image" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <FaFileImage className="h-4.5 w-4.5" />
                                </button>
                                <button title="Time" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <IoIosTime className="h-4.5 w-4.5" />
                                </button>
                                <button title="Date" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <IoCalendar className="h-4.5 w-4.5" />
                                </button>
                                <button title="Data" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <LuCable className="h-4.5 w-4.5" />
                                </button>
                                <button title="Dive" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <FaPersonSwimming className="h-4.5 w-4.5" />
                                </button>
                                <button title="Nodes" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <FaFolderTree className="h-4.5 w-4.5" />
                                </button>
                            </div>
                            <div className="flex-1 bg-black">
                                <OverlayEditorCanvas>

                                </OverlayEditorCanvas>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="flex-none h-full w-[300px]">
                    <Tabs defaultValue="properties" className="h-full">
                        <TabsList>
                            <TabsTrigger value="properties">Properties</TabsTrigger>
                        </TabsList>
                        <TabsContent value="properties" className="flex flex-col gap-1">
                            <div className="flex gap-1">
                                <button title="Edit Component" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdEdit className="h-4.5 w-4.5" />
                                </button>
                                <button title="Delete Component" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
                                    <MdDelete className="h-4.5 w-4.5" />
                                </button>
                            </div>
                            <ComponentList/>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <DraggableDialog
                open={newOverlayOpen}
                onOpenChange={setNewOverlayOpen}
                title="New Overlay"
            >
                <CreateOverlayForm onClose={() => setNewOverlayOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={renameOverlayOpen}
                onOpenChange={setRenameOverlayOpen}
                title="Rename Overlay"
            >
                <RenameOverlayForm onClose={() => setRenameOverlayOpen(false)} />
            </DraggableDialog>
            <DraggableDialog
                open={deleteOverlayOpen}
                onOpenChange={setDeleteOverlayOpen}
                title="Delete Overlay"
            >
                <DeleteOverlayConfirmation onClose={() => setDeleteOverlayOpen(false)} />
            </DraggableDialog>
        </div>
    )
}