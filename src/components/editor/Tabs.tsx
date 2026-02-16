import clsx from "clsx";

// export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
//     return (
//         <div class="proeminent-button flex h-11 w-fit rounded-full p-1 absolute z-100 left-1/2 -translate-x-1/2 -translate-y-1/2">
//             {props.values.map((value) => (
//                 <button
//                     class={clsx(
//                         "flex h-full items-center justify-center rounded-full px-6 font-medium font-mono text-sm",
//                         value === props.active &&
//                             "shadow-0_2px_20px_rgba(0,0,0,0.06) bg-fill-tertiary text-blue",
//                     )}
//                     onClick={() => props.onChange(value)}
//                 >
//                     {value}
//                 </button>
//             ))}
//         </div>
//     );
// }

export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
    return (
        <div class="proeminent-button backdrop-blur-md flex h-11 w-fit rounded-full p-1 absolute z-100 left-1/2 -translate-x-1/2 -translate-y-1/2">
            {props.values.map((value) => (
                <button
                    class={clsx(
                        "flex h-full items-center justify-center rounded-full px-6 text-sm",
                        value === props.active &&
                            "shadow-0_2px_20px_rgba(0,0,0,0.06) bg-white text-primary dark:bg-[#6C6C71] shadow-secondary",
                    )}
                    onClick={() => props.onChange(value)}
                >
                    {value}
                </button>
            ))}
        </div>
    );
}
