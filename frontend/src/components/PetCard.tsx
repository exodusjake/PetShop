import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { AdoptionPet } from '../lib/types';
import { formatAge } from '../lib/format';

const STATUS: Record<AdoptionPet['status'], string> = {
  AVAILABLE: 'bg-softgreen text-green-800', PENDING: 'bg-yellow-100 text-yellow-800', ADOPTED: 'bg-gray-200 text-gray-600',
};

export default function PetCard({ pet, heading: Heading = 'h3' }: { pet: AdoptionPet; heading?: 'h2' | 'h3' }) {
  return (
    <article className="card card-hover overflow-hidden">
      <div className="relative bg-[#FDEEE3]">
        {pet.photoUrl && <img src={pet.photoUrl} alt={`${pet.name}, a ${pet.breed}`} loading="lazy" className="aspect-[1.4] w-full object-cover" />}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-extrabold ${STATUS[pet.status]}`}>{pet.status.charAt(0) + pet.status.slice(1).toLowerCase()}</span>
      </div>
      <div className="p-4">
        <Heading className="text-xl font-semibold">{pet.name}</Heading>
        <p className="text-sm font-semibold text-choco-soft">{pet.species} · {pet.breed}</p>
        <p className="mt-1 text-sm text-choco-soft">{formatAge(pet.ageMonths)} · {pet.gender}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-choco-soft"><MapPin size={13} />{pet.location}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to={`/adoption/${pet.id}`} className="btn btn-ghost btn-sm">View Details</Link>
          {pet.status === 'ADOPTED'
            ? <span className="btn btn-sm cursor-not-allowed opacity-50">Adopted</span>
            : <Link to={`/adoption/${pet.id}#apply`} className="btn btn-sm">Apply to Adopt</Link>}
        </div>
      </div>
    </article>
  );
}
