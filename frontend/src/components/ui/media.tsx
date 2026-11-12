type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "alt"> & { alt?: string };

/** Archive images come from the API (access checked on the server), so no optimizer is involved. */
export function Media({ alt = "", loading = "lazy", ...rest }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading={loading} decoding="async" {...rest} />;
}
