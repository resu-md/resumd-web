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
        <div class="proeminent-button absolute left-1/2 z-100 flex h-9.5 w-fit -translate-x-1/2 -translate-y-1/2 rounded-full p-0.75 backdrop-blur-md">
            {props.values.map((value) => (
                <button
                    class={clsx(
                        "flex h-full items-center justify-center rounded-full px-4.5 text-sm",
                        value === props.active &&
                            "shadow-0_2px_20px_rgba(0,0,0,0.06) text-primary shadow-secondary bg-white dark:bg-[#6C6C71]",
                    )}
                    onClick={() => props.onChange(value)}
                >
                    {value}
                </button>
            ))}
        </div>
    );
}
