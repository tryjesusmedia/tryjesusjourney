import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Card, Eyebrow, OutlineButton } from '@/components/ui';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; slug: string; images?: {url?: string; transformedUrl?: string}[]; variants?: {unitPrice?: {value?: number; currency?: string}}[]; storefrontUrl: string; pinned?: boolean };

function selectProducts(incoming: Product[]) {
  const bibleDecoded = incoming.find((product) => /bible[\s-]*decoded/i.test(`${product.name} ${product.slug}`)) ?? incoming.find((product) => product.pinned);
  const others = incoming.filter((product) => product !== bibleDecoded).sort(() => Math.random() - 0.5);
  return bibleDecoded ? [bibleDecoded, ...others.slice(0, 2)] : incoming.slice(0, 3);
}

export default function ProgramsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<Product>>(null);

  useEffect(() => { supabase.functions.invoke('random-fourthwall-products', { body: {} }).then(({ data, error }) => { if (data?.products && !error) setProducts(selectProducts(data.products)); }); }, []);
  useEffect(() => { if (products.length < 2 || !width) return; const timer = setInterval(() => setIndex((current) => { const next = (current + 1) % products.length; list.current?.scrollToOffset({ offset: next * width, animated: true }); return next; }), 3000); return () => clearInterval(timer); }, [products.length, width]);

  return <View style={styles.page}>
    <Eyebrow>CONTINUE YOUR JOURNEY</Eyebrow><Text style={styles.title}>Programs & resources selected for you.</Text>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <FlatList ref={list} data={products} keyExtractor={(item) => item.id ?? item.slug} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => width && setIndex(Math.round(event.nativeEvent.contentOffset.x / width))} renderItem={({item, index: itemIndex}) => {
        const image = item.images?.[0]?.transformedUrl ?? item.images?.[0]?.url; const price = item.variants?.[0]?.unitPrice;
        return <View style={{width:width||undefined}}><Card style={styles.card}>{image?<Image source={{uri:image}} style={styles.image}/>:null}<Text style={styles.pin}>{itemIndex===0?'FEATURED PROGRAM':'RESOURCE'}</Text><Text style={styles.name}>{item.name}</Text>{price?.value!=null?<Text style={styles.meta}>{price.currency??'USD'} ${Number(price.value).toFixed(2)}</Text>:null}<OutlineButton title="View on Fourthwall" onPress={()=>Linking.openURL(item.storefrontUrl)}/></Card></View>;
      }}/>
    </View>
    <View style={styles.dots}>{products.map((item,i)=><View key={item.id??item.slug} style={[styles.dot,index===i&&styles.activeDot]}/>)}</View>
  </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.charcoal,padding:20,paddingTop:52},title:{color:colors.text,fontSize:25,fontWeight:'900',lineHeight:31,marginBottom:16},card:{padding:14},image:{width:'100%',aspectRatio:1.6,borderRadius:14,backgroundColor:colors.plum,marginBottom:12},pin:{color:colors.gold,fontSize:10,fontWeight:'900',letterSpacing:1.4,marginBottom:5},name:{color:colors.text,fontSize:19,fontWeight:'900',marginBottom:6},meta:{color:colors.muted,fontSize:13,marginBottom:14},dots:{flexDirection:'row',justifyContent:'center',gap:7,marginTop:12},dot:{width:7,height:7,borderRadius:4,backgroundColor:colors.border},activeDot:{width:18,backgroundColor:colors.gold}});
