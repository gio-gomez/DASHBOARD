import pandas as pd
import json
import urllib.request
import os
import unicodedata
def normalize_state_name(name):
    if not isinstance(name, str):
        return ""
    # Replace underscores
    name = name.replace('_', ' ')
    # Convert to lowercase
    name = name.lower().strip()
    # Normalize unicode to strip accents
    name = unicodedata.normalize('NFD', name)
    name = "".join([c for c in name if not unicodedata.combining(c)])
    # Custom mappings
    if 'distrito federal' in name or 'ciudad de mexico' in name:
        return 'ciudad de mexico'
    if 'michoacan' in name:
        return 'michoacan'
    if 'veracruz' in name:
        return 'veracruz'
    if 'coahuila' in name:
        return 'coahuila'
    return name
def process_data():
    project_dir = os.getcwd()
    
    # 1. Download GeoJSON if not exists
    geojson_path = os.path.join(project_dir, "mexico.json")
    if not os.path.exists(geojson_path):
        print("Downloading GeoJSON of Mexican states...")
        url = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/mexico.geojson"
        try:
            urllib.request.urlretrieve(url, geojson_path)
            print("GeoJSON downloaded successfully.")
        except Exception as e:
            print("Failed to download GeoJSON:", e)
            return
    # Load local datasets
    ingresos_edad_path = os.path.join(project_dir, "ingresos_edad.xlsx")
    ingresos_ocup_path = os.path.join(project_dir, "ingresos_ocupacion.xlsx")
    tasa_desoc_path = os.path.join(project_dir, "tasa_desocupacion.xlsx")
    ingresos_estatal_path = os.path.join(project_dir, "ingreso_estatal_inegi.csv")
    df_edad = pd.read_excel(ingresos_edad_path)
    df_ocup = pd.read_excel(ingresos_ocup_path)
    df_desoc = pd.read_excel(tasa_desoc_path)
    df_estatal = pd.read_csv(ingresos_estatal_path)
    print("Loaded all files successfully.")
    # 2. Compile Dashboard 1: Ingresos Medios (National)
    # Average income by sex over time
    ingreso_sexo = df_edad[['periodo', 'hombres', 'mujeres', 'total']].to_dict(orient='records')
    
    # Average income by age group over time (for Radar)
    # Age columns: total_15_24, total_25_44, total_45_64, total_65_y_mas
    ingreso_edad_grupos = {}
    for _, row in df_edad.iterrows():
        year = int(row['periodo'])
        ingreso_edad_grupos[year] = {
            "De 15 a 24 años": float(row['total_15_24']),
            "De 25 a 44 años": float(row['total_25_44']),
            "De 45 a 64 años": float(row['total_45_64']),
            "De 65 años y más": float(row['total_65_y_mas'])
        }
    # Average income by occupation over time (for Bar)
    # Occupation columns
    occup_cols = {
        "total_directores": "Directores y gerentes",
        "total_profesionales": "Profesionales e intelectuales",
        "total_tecnicos": "Técnicos y nivel medio",
        "total_administrativo": "Apoyo administrativo",
        "total_comercio": "Comerciantes y ventas",
        "total_agricultores": "Trabajadores agropecuarios",
        "total_artesanos": "Artesanos y construcción",
        "total_operadores": "Operadores de maquinaria",
        "total_elementares": "Actividades elementales",
        "total_militares": "Fuerzas armadas"
    }
    ingreso_ocupacion = {}
    for _, row in df_ocup.iterrows():
        year = int(row['periodo'])
        ingreso_ocupacion[year] = {clean_name: float(row[col]) for col, clean_name in occup_cols.items()}
    # 3. Compile Dashboard 2: Tasa de Desocupación
    # Clean desocupacion dataset states
    df_desoc['normalized_estado'] = df_desoc['estado'].apply(normalize_state_name)
    
    # National average desocupacion over time
    df_desoc_nac = df_desoc[df_desoc['normalized_estado'] == 'estados unidos mexicanos']
    desoc_nacional = df_desoc_nac[['periodo', 'total', 'hombres', 'mujeres']].sort_values('periodo').to_dict(orient='records')
    
    # State-level desocupacion
    df_desoc_states = df_desoc[df_desoc['normalized_estado'] != 'estados unidos mexicanos']
    
    # Boxplot data: 2006 vs 2024
    desoc_2006 = df_desoc_states[df_desoc_states['periodo'] == 2006]['total'].dropna().tolist()
    desoc_2024 = df_desoc_states[df_desoc_states['periodo'] == 2024]['total'].dropna().tolist()
    desoc_boxplot_data = {
        "2006": desoc_2006,
        "2024": desoc_2024
    }
    # State comparison data for 2006 vs 2024 (ordered by 2024 value)
    states_2006_df = df_desoc_states[df_desoc_states['periodo'] == 2006][['estado', 'total']].rename(columns={'total': 'total_2006'})
    states_2024_df = df_desoc_states[df_desoc_states['periodo'] == 2024][['estado', 'total']].rename(columns={'total': 'total_2024'})
    
    # Normalizing names for merge
    states_2006_df['normalized_estado'] = states_2006_df['estado'].apply(normalize_state_name)
    states_2024_df['normalized_estado'] = states_2024_df['estado'].apply(normalize_state_name)
    
    merged_desoc = pd.merge(states_2024_df, states_2006_df, on='normalized_estado').sort_values('total_2024', ascending=False)
    
    # Mapping to display state name correctly
    state_display_names = {
        "aguascalientes": "Aguascalientes",
        "baja california": "Baja California",
        "baja california sur": "Baja California Sur",
        "campeche": "Campeche",
        "coahuila de zaragoza": "Coahuila",
        "coahuila": "Coahuila",
        "colima": "Colima",
        "chiapas": "Chiapas",
        "chihuahua": "Chihuahua",
        "ciudad de mexico": "Ciudad de México",
        "durango": "Durango",
        "guanajuato": "Guanajuato",
        "guerrero": "Guerrero",
        "hidalgo": "Hidalgo",
        "jalisco": "Jalisco",
        "mexico": "Estado de México",
        "michoacan de ocampo": "Michoacán",
        "michoacan": "Michoacán",
        "morelos": "Morelos",
        "nayarit": "Nayarit",
        "nuevo leon": "Nuevo León",
        "oaxaca": "Oaxaca",
        "puebla": "Puebla",
        "queretaro": "Querétaro",
        "quintana roo": "Quintana Roo",
        "san luis potosi": "San Luis Potosí",
        "sinaloa": "Sinaloa",
        "sonora": "Sonora",
        "tabasco": "Tabasco",
        "tamaulipas": "Tamaulipas",
        "tlaxcala": "Tlaxcala",
        "veracruz de ignacio de la llave": "Veracruz",
        "veracruz": "Veracruz",
        "yucatan": "Yucatán",
        "zacatecas": "Zacatecas"
    }
    
    desoc_state_comparison = []
    for _, row in merged_desoc.iterrows():
        norm = row['normalized_estado']
        display_name = state_display_names.get(norm, row['estado_x'].replace('_', ' '))
        desoc_state_comparison.append({
            "normalized": norm,
            "display": display_name,
            "val_2006": float(row['total_2006']),
            "val_2024": float(row['total_2024'])
        })
    # Historical trends per state
    desoc_trends = {}
    for state_norm in df_desoc_states['normalized_estado'].unique():
        state_data = df_desoc_states[df_desoc_states['normalized_estado'] == state_norm].sort_values('periodo')
        display_name = state_display_names.get(state_norm, state_data.iloc[0]['estado'].replace('_', ' '))
        desoc_trends[state_norm] = {
            "display": display_name,
            "years": state_data['periodo'].tolist(),
            "rates": state_data['total'].tolist()
        }
    # 4. Compile Dashboard 3: Mapas y Relación (2016-2024 overlap)
    # State factors from CSV
    df_estatal['normalized_estado'] = df_estatal['estado'].apply(normalize_state_name)
    state_factors = dict(zip(df_estatal['normalized_estado'], df_estatal['factor_relativo']))
    # Yearly state statistics
    # We will build a data structure: { year: { state_norm: { income, desocupacion } } }
    relacion_anual = {}
    
    # Overlapping years (2016 to 2024)
    overlap_years = range(2016, 2025)
    
    for year in overlap_years:
        relacion_anual[year] = {}
        # Get national average income for this year
        nat_income = float(df_edad[df_edad['periodo'] == year]['total'].iloc[0])
        # Get national average unemployment for this year
        nat_desoc = float(df_desoc_nac[df_desoc_nac['periodo'] == year]['total'].iloc[0])
        
        # Get state-level unemployment for this year
        year_desoc_df = df_desoc_states[df_desoc_states['periodo'] == year]
        
        for _, row in year_desoc_df.iterrows():
            norm_state = row['normalized_estado']
            display_name = state_display_names.get(norm_state, row['estado'].replace('_', ' '))
            
            # State factor
            factor = state_factors.get(norm_state, 1.0)
            
            # State unemployment rate
            state_desoc_val = float(row['total'])
            
            # Apply econometric adjustment: income is slightly lower if state unemployment is higher than national
            adjusted_factor = factor * (1.0 - 0.02 * (state_desoc_val - nat_desoc))
            estimated_income = round(nat_income * adjusted_factor, 2)
            
            relacion_anual[year][norm_state] = {
                "display": display_name,
                "income": estimated_income,
                "unemployment": round(state_desoc_val, 4)
            }
    # Combine everything into one JSON structure
    dashboard_data = {
        "dashboard1": {
            "ingreso_sexo": ingreso_sexo,
            "ingreso_edad_grupos": ingreso_edad_grupos,
            "ingreso_ocupacion": ingreso_ocupacion
        },
        "dashboard2": {
            "boxplot_data": desoc_boxplot_data,
            "state_comparison": desoc_state_comparison,
            "trends": desoc_trends,
            "national_trend": desoc_nacional
        },
        "dashboard3": {
            "relacion_anual": relacion_anual
        }
    }
    # Save to file
    out_path = os.path.join(project_dir, "data.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard_data, f, ensure_ascii=False, indent=2)
    print(f"Successfully processed data and wrote to: {out_path}")
if __name__ == "__main__":
    process_data()
    