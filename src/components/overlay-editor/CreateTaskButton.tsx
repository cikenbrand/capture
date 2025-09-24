import { FaTasks } from "react-icons/fa";

export default function CreateTaskButton() {
    return (
        <button title="Task" className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
            <FaTasks className="h-4.5 w-4.5" />
        </button>
    )
}