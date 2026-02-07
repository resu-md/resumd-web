import clsx from "clsx";

// https://ionicframework.com/docs/api/segment
// export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
//     return (
//         <div class="bg-fill-secondary mx-auto my-2 flex w-fit rounded-lg p-0.5">
//             {props.values.map((value) => (
//                 <button
//                     type="button"
//                     class={clsx(
//                         "h-6 rounded-md px-3 text-sm tracking-tight",
//                         value === props.active
//                             ? "bg-system-primary shadow-primary text-label-primary"
//                             : "text-label-secondary",
//                     )}
//                     onClick={() => props.onChange(value)}
//                 >
//                     {String(value)}
//                 </button>
//             ))}
//         </div>
//     );
// }

export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
    return (
        <div class="bg-system-tertiary flex w-full">
            {props.values.map((value, index) => (
                <button
                    type="button"
                    class={clsx(
                        "h-8 border-[#E3E3E3] px-4 text-sm tracking-tight dark:border-none flex-1 ",
                        value === props.active
                            ? "bg-system-primary border-r pb-px dark:pb-0"
                            : "text-label-secondary border-b hover:bg-fill-quaternary",
                        value === props.active && index !== 0 && "border-l",
                    )}
                    onClick={() => props.onChange(value)}
                >
                    {String(value)}
                </button>
            ))}
            {/* <div class="flex-1 border-b border-[#E3E3E3] dark:border-none" /> */}
        </div>
    );
}
